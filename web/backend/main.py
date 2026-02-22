"""
Property Guru 房源抓取 API
POST /api/scrape-property 传入 URL，返回抓取到的房源信息（同步，用于刷新按钮）
POST /api/trigger-scrape 传入 property_id + url，立即返回 202，后台异步抓取并写入数据库

限流规则：
- 同一 URL/property 正在抓取时，返回 429「点得太快了」
- 同一 property_id 1 小时内已抓取过，返回 202 但不实际执行（静默跳过）
"""
import os
import re
import time
from threading import Lock
from typing import Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright

# 加载 .env（项目根或 backend 同目录）
for d in [os.path.dirname(os.path.dirname(os.path.dirname(__file__))), os.path.dirname(__file__)]:
    env_path = os.path.join(d, ".env")
    if os.path.isfile(env_path):
        load_dotenv(env_path)
        break

app = FastAPI(title="Property Scrape API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    url: str


class TriggerScrapeRequest(BaseModel):
    """异步触发抓取：立即返回，后台抓取完成后写入数据库"""
    property_id: str
    url: str


class SitePlanRequest(BaseModel):
    apartment_name: str


class SitePlanResponse(BaseModel):
    site_plan_url: str


class ScrapeResponse(BaseModel):
    title: str
    link: str
    price: Optional[str] = None
    price_value: Optional[str] = None  # 价格数值部分，如 S$1,500,000
    price_description: Optional[str] = None  # 价格描述，如 negotiable、Starting from
    size_sqft: Optional[str] = None
    bedrooms: Optional[str] = None
    bathrooms: Optional[str] = None
    main_image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None  # 第一张主图 + 第二张户型图
    floor_plan_url: Optional[str] = None
    basic_info: Optional[str] = None
    listing_agent_name: Optional[str] = None  # 卖家中介姓名
    listing_agent_phone: Optional[str] = None  # 卖家中介电话
    listing_type: Optional[str] = None  # 'sale' | 'rent' 出售 vs 出租
    lease_tenure: Optional[str] = None  # 地契：99年地契、999年地契、永久地契
    top_year: Optional[str] = None  # TOP 年份（入伙年份），如 2020
    site_plan_url: Optional[str] = None  # 公寓小区平面图，从 99.co 抓取


def _parse_price_into_value_and_description(price_text: str) -> tuple[Optional[str], Optional[str]]:
    """将完整价格文本拆分为数值和描述，如 'S$1.5M negotiable' -> ('S$1.5M', 'negotiable')"""
    if not price_text or not price_text.strip():
        return None, None
    text = price_text.strip()
    text_lower = text.lower()
    # 描述词在后面的：negotiable, POA, price on request 等
    for pattern, desc_name in [(r"\bnegotiable\b", "negotiable"), (r"\bpoa\b", "POA")]:
        m = re.search(pattern, text_lower, re.I)
        if m:
            value = re.sub(pattern, " ", text, flags=re.I)
            value = " ".join(value.split()).strip()
            return value or None, desc_name
    for pattern, desc_name in [
        (r"\bprice on request\b", "Price on request"),
        (r"\bcall for price\b", "Call for price"),
        (r"\bcontact for price\b", "Contact for price"),
    ]:
        m = re.search(pattern, text_lower, re.I)
        if m:
            value = re.sub(pattern, " ", text, flags=re.I)
            value = " ".join(value.split()).strip()
            return value or None, desc_name
    # 描述词在前面的：Starting from, From
    for pattern, desc_name in [
        (r"^\s*starting\s+from\s+", "Starting from"),
        (r"^\s*from\s+", "From"),
    ]:
        m = re.search(pattern, text_lower, re.I)
        if m:
            value = re.sub(pattern, "", text, flags=re.I).strip()
            return value or None, desc_name
    return text, None


def _normalize_propertyguru_url(url: str) -> str:
    """统一 Property Guru / Property Group 等链接格式，便于去重"""
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    return url.rstrip("/")


def _detect_lease_tenure(body: str) -> Optional[str]:
    """从页面内容识别地契/租期，仅对出售房源有意义（兜底逻辑，优先从项目页抓取）"""
    body_lower = body.lower()
    # 永久/Freehold 优先。注意：不能用裸的「永久」，否则会误匹配「永久居民」(PR)，把99年地契误判为永久
    if re.search(r"\bfreehold\b|永久地契|永久产权|永久(?!居民)", body_lower):
        return "永久地契"
    # 999 必须先于 99 检查，避免误判
    if re.search(r"999\s*[- ]?year|999\s*年|999年地契", body_lower):
        return "999年地契"
    if re.search(r"\b99\s*[- ]?year|\b99\s*年|99年地契|leasehold", body_lower):
        return "99年地契"
    return None


def _normalize_tenure_text(raw: str) -> Optional[str]:
    """将项目页抓取的 tenure 原始文本标准化为 99年地契/999年地契/永久地契"""
    if not raw or not raw.strip():
        return None
    t = raw.strip().lower()
    if re.search(r"\bfreehold\b|永久", t) and "居民" not in t:
        return "永久地契"
    if re.search(r"999\s*[- ]?year|999\s*年", t):
        return "999年地契"
    if re.search(r"\b99\s*[- ]?year|\b99\s*年|leasehold", t):
        return "99年地契"
    return None


def _extract_apartment_name(title: str) -> Optional[str]:
    """从房源 title 提取公寓/项目名，用于 99.co 查询"""
    if not title or len(title.strip()) < 2:
        return None
    t = title.strip()
    # "Project - 2 Bedroom" -> Project
    m = re.match(r"^(.+?)\s*[-–—]\s+", t)
    if m:
        return m.group(1).strip()
    # "2 Bed at Project Name" -> Project Name
    m = re.search(r"\s+at\s+(.+)$", t, re.I)
    if m:
        return m.group(1).strip()
    return t


def _apartment_name_to_slug(name: str) -> str:
    """将公寓名称转为 99.co URL 的 slug：去掉特殊字符、空格变横线"""
    # 去掉特殊字符（如 @），只保留字母、数字、空格、连字符
    slug = re.sub(r"[^a-zA-Z0-9\s\-]", "", name.strip())
    # 将单个或多个空格统一替换为单个 -
    slug = re.sub(r"\s+", "-", slug)
    slug = slug.lower().strip("-")
    for suffix in ["-condo", "-residences", "-residence"]:
        if slug.endswith(suffix):
            slug = slug[: -len(suffix)]
    return slug


def _is_generic_site_title(title: str) -> bool:
    """判断 title 是否为网站域名/通用名而非房源详情（如 www.propertyguru.com、www.propertygroup.com）"""
    if not title or len(title.strip()) < 3:
        return True
    t = title.strip().lower()
    # 纯域名格式：www.xxx.com、propertyguru.com.sg、propertygroup.com
    if re.match(r"^(www\.)?[a-z0-9\-]+\.(com|sg|my|net|org)(\.[a-z]{2,})?$", t):
        return True
    # 以 www. 开头且含 .com/.sg 等，基本可判定为域名
    if re.match(r"^www\.[a-z0-9\-\.]+\.(com|sg|my|net|org)", t):
        return True
    # 仅包含 "propertyguru" 或 "propertygroup" 且无房源关键词
    if re.match(r"^property(guru|group)(\.com)?\.?sg?$", t) or t in ("propertyguru", "propertygroup"):
        return True
    return False


def _detect_listing_type(url: str, body: str) -> Optional[str]:
    """从 URL 或页面内容识别房源类型：出售 vs 出租"""
    url_lower = url.lower()
    if "/for-sale/" in url_lower or "/for_sale/" in url_lower:
        return "sale"
    if "/for-rent/" in url_lower or "/for_rent/" in url_lower or "/rent/" in url_lower:
        return "rent"
    body_lower = body.lower()
    # 页面文案常见：For Sale / For Rent
    if "for sale" in body_lower or "for-sale" in body_lower:
        return "sale"
    if "for rent" in body_lower or "for-rent" in body_lower or "for rent" in body_lower:
        return "rent"
    return None


async def _run_property_scraper(url: str) -> ScrapeResponse:
    """执行房源抓取，返回抓取结果。供同步接口和后台任务共用。"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        try:
            # 使用 load 而非 networkidle：Property Guru 等网站有大量后台请求，networkidle 难以达成
            await page.goto(url, wait_until="load", timeout=30000)
            await page.wait_for_timeout(2000)
            # 等待房源标题或主内容区域出现（SPA 可能异步渲染）
            try:
                await page.wait_for_selector(
                    "h1, [data-automation-id*='listing'], [class*='listing-detail']",
                    timeout=5000,
                )
                await page.wait_for_timeout(800)
            except Exception:
                pass

            title = ""
            price: Optional[str] = None
            size_sqft: Optional[str] = None
            bedrooms: Optional[str] = None
            bathrooms: Optional[str] = None
            main_image_url: Optional[str] = None
            image_urls: list[str] = []
            floor_plan_url: Optional[str] = None
            basic_info_parts: list[str] = []

            # Title: 优先从页面内房源标题元素抓取，避免 og:title 仅为 www.propertyguru.com 等网站域名
            title_selectors = [
                '[data-automation-id="listing-detail-title"]',
                '[data-automation-id*="listing-detail"] h1',
                '[data-automation-id*="listing-title"]',
                '[class*="listing-title"]',
                '[class*="listing-detail-title"]',
                'h1[class*="listing"]',
                'h1',
            ]
            for sel in title_selectors:
                try:
                    el = page.locator(sel).first
                    txt = await el.text_content(timeout=500)
                    if txt and len(txt.strip()) > 5 and not _is_generic_site_title(txt):
                        title = txt.strip()
                        break
                except Exception:
                    pass

            # og:title 仅当不是域名/网站名时使用
            if not title:
                og_title = await page.evaluate(
                    """() => {
                    const m = document.querySelector('meta[property="og:title"]');
                    return m ? m.getAttribute('content') : '';
                }"""
                )
                if og_title and not _is_generic_site_title(og_title):
                    title = og_title

            # document.title 兜底（某些 SPA 会动态设置）
            if not title:
                doc_title = await page.title()
                if doc_title and not _is_generic_site_title(doc_title):
                    title = doc_title

            if not title:
                title = "Property"

            # Price: 常见选择器
            price_selectors = [
                '[data-automation-id="listing-detail-price"]',
                '[class*="price"]',
                '[data-testid*="price"]',
                'span:has-text("S$")',
                'span:has-text("$")',
            ]
            for sel in price_selectors:
                try:
                    el = page.locator(sel).first
                    txt = await el.text_content(timeout=500)
                    if txt and re.search(r"[\$S].*[\d,]+", txt):
                        price = txt.strip()
                        break
                except Exception:
                    pass

            if not price:
                body = await page.content()
                price_match = re.search(
                    r"S?\$[\s]*[\d,]+(?:\s*(?:million|mil|k|K))?", body
                )
                if price_match:
                    price = price_match.group(0).strip()

            # Size: sqft
            size_selectors = [
                'text=/\\d+\\s*sqft/i',
                'text=/\\d+\\s*sq\s*ft/i',
                '[class*="size"]',
                '[data-automation-id*="size"]',
            ]
            for sel in size_selectors:
                try:
                    el = page.locator(sel).first
                    txt = await el.text_content(timeout=500)
                    if txt and re.search(r"\d+\s*sq", txt, re.I):
                        size_sqft = txt.strip()
                        break
                except Exception:
                    pass

            body = await page.content()
            if not size_sqft:
                size_match = re.search(r"(\d[\d,]*)\s*sq\s*ft", body, re.I)
                if size_match:
                    size_sqft = f"{size_match.group(1)} sqft"

            # Bedrooms & Bathrooms: 常见格式 2 Bedrooms, 3 Bathrooms 或 2Bedroom 2Bathroom
            bed_match = re.search(r"(\d+)\s*bed(?:room)?s?", body, re.I)
            if bed_match:
                bedrooms = bed_match.group(1) + " 房"
            bath_match = re.search(r"(\d+)\s*bath(?:room)?s?", body, re.I)
            if bath_match:
                bathrooms = bath_match.group(1) + " 卫"
            price_value, price_description = _parse_price_into_value_and_description(price) if price else (None, None)
            if price:
                basic_info_parts.append(price)
            if size_sqft:
                basic_info_parts.append(size_sqft)
            if bedrooms:
                basic_info_parts.append(bedrooms)
            if bathrooms:
                basic_info_parts.append(bathrooms)
            basic_info = " | ".join(basic_info_parts) if basic_info_parts else None

            # 收集第一张主图 + 第二张户型图（排除 logo、网站图标等）
            def _is_logo_or_ui(src: str, alt: str) -> bool:
                """排除 logo、favicon、品牌图等非房源图"""
                if not src:
                    return True
                s = src.lower()
                a = (alt or "").lower()
                skip = ["logo", "favicon", "brand", "icon", "avatar", "placeholder"]
                return any(x in s or x in a for x in skip)

            og_image = await page.evaluate(
                """() => {
                const m = document.querySelector('meta[property="og:image"]');
                return m ? m.getAttribute('content') : '';
            }"""
            )
            # og:image 可能是网站 logo，仅当不含 logo 且无更好选择时使用
            if og_image and _is_logo_or_ui(og_image, ""):
                og_image = None

            # 优先从主图区域抓取第一张房源图（排除户型图）
            gallery_selectors = [
                '[data-automation-id*="listing-gallery"] img',
                '[data-automation-id*="listing-detail"] img',
                '[class*="listing-gallery"] img',
                '[class*="listing-images"] img',
                '[class*="property-gallery"] img',
                '[class*="photo-gallery"] img',
                'img[src*="pgimgs.com/listing"]',
                'img[src*="pgimgs"]',
                '[class*="gallery"] img',
                '[class*="carousel"] img',
            ]
            seen_srcs: set[str] = set()
            for selector in gallery_selectors:
                if len(image_urls) >= 1 and main_image_url:
                    break
                try:
                    imgs = await page.locator(selector).all()
                    for img in imgs[:12]:
                        if len(image_urls) >= 1 and main_image_url:
                            break
                        src = await img.get_attribute("src")
                        alt = await img.get_attribute("alt") or ""
                        if not src or src in seen_srcs:
                            continue
                        if "floor" in src.lower() or "plan" in src.lower():
                            continue
                        if _is_logo_or_ui(src, alt):
                            continue
                        # 可选：排除过小图片（logo 通常 < 80px）
                        try:
                            box = await img.bounding_box()
                            if box and (box["width"] < 60 or box["height"] < 60):
                                continue
                        except Exception:
                            pass
                        seen_srcs.add(src)
                        if not main_image_url:
                            main_image_url = src
                        if len(image_urls) < 1:
                            image_urls.append(src)
                except Exception:
                    pass

            # 若仍未找到，才用 og:image 作为兜底（且确认不是 logo）
            if og_image and not main_image_url:
                main_image_url = og_image
            if og_image and len(image_urls) < 1 and og_image not in image_urls:
                image_urls.insert(0, og_image)

            # Floor plan: 优先从 Property Guru 媒体画廊的 floorPlans-section 抓取（可能在 modal 内）
            floor_plan_selectors = [
                'img[da-id="media-gallery-floorPlans"]',
                'img.floorPlans',
                '.floorPlans-section img',
                'img.media-image.floorPlans',
            ]
            for sel in floor_plan_selectors:
                try:
                    if await page.locator(sel).count() > 0:
                        src = await page.locator(sel).first.get_attribute("src", timeout=2000)
                        if src:
                            floor_plan_url = src
                            break
                except Exception:
                    pass
            # 若 modal 未打开导致找不到，尝试点击打开媒体画廊
            if not floor_plan_url:
                try:
                    gallery_loc = page.locator(
                        '[data-automation-id*="media-gallery"], [data-automation-id*="gallery"], '
                        '[class*="media-gallery"] button, [class*="photo-gallery"] button, '
                        'button:has-text("View"), a:has-text("View all"), [class*="gallery"] [role="button"]'
                    ).first
                    if await gallery_loc.count() > 0:
                        await gallery_loc.click()
                        await page.wait_for_timeout(1500)
                        for sel in floor_plan_selectors:
                            try:
                                if await page.locator(sel).count() > 0:
                                    src = await page.locator(sel).first.get_attribute("src", timeout=2000)
                                    if src:
                                        floor_plan_url = src
                                        break
                            except Exception:
                                pass
                except Exception:
                    pass
            # 兜底：含 floor/plan 的图
            if not floor_plan_url:
                floor_imgs = await page.locator(
                    'img[src*="floor"], img[src*="plan"], [alt*="floor" i] img, [alt*="plan" i] img'
                ).all()
                for img in floor_imgs[:3]:
                    src = await img.get_attribute("src")
                    if src:
                        floor_plan_url = src
                        break

            # image_urls: 第一张主图 + 第二张户型图
            if floor_plan_url and floor_plan_url not in image_urls:
                image_urls.append(floor_plan_url)

            # 卖家中介：姓名与电话（Property Guru 常见结构）
            listing_agent_name: Optional[str] = None
            listing_agent_phone: Optional[str] = None
            # 1. 优先从 tel: 链接提取电话
            tel_links = await page.locator('a[href^="tel:"]').all()
            for tel in tel_links[:8]:
                href = await tel.get_attribute("href")
                if href:
                    phone = re.sub(r"[\s\-]", "", href.replace("tel:", "").strip())
                    if re.search(r"^\+?[\d]{8,15}$", phone):
                        listing_agent_phone = phone
                        # 尝试从同一区域获取中介姓名（父级容器内找非按钮文字）
                        if not listing_agent_name:
                            try:
                                parent = tel.locator("xpath=ancestor::*[contains(@class, 'agent') or contains(@class, 'contact') or contains(@class, 'listing')][1]")
                                if await parent.count() > 0:
                                    parent_txt = await parent.first.text_content(timeout=300)
                                    if parent_txt:
                                        skip_words = {"contact", "call", "whatsapp", "phone", "sms", "enquire", "view"}
                                        for part in re.split(r"[\s\n]+", parent_txt.replace(phone, "")):
                                            s = part.strip()
                                            if 2 <= len(s) <= 40 and not re.search(r"^[\d\+\-]+$", s) and s.lower() not in skip_words:
                                                listing_agent_name = s
                                                break
                            except Exception:
                                pass
                        break
            # 2. 正则从 HTML 中提取 tel:
            if not listing_agent_phone:
                tel_match = re.search(r'tel:(\+?[\d\s\-\.]{8,25})', body)
                if tel_match:
                    p = re.sub(r"[\s\-\.]", "", tel_match.group(1))
                    if re.search(r"^\+?[\d]{8,15}$", p):
                        listing_agent_phone = p
            # 3. 兜底：新加坡常见格式 +65 8/9xxx xxxx 或 8 位手机号
            if not listing_agent_phone:
                sg_phone_patterns = [
                    r"(?:\+65|65)\s*(\d[\d\s]{6,11})",
                    r"(\+65\s*\d{4}\s*\d{4})",
                    r"(?:contact|call|phone|tel)[:\s]*(\+?[\d\s\-]{8,20})",
                ]
                for pat in sg_phone_patterns:
                    m = re.search(pat, body, re.I)
                    if m:
                        p = re.sub(r"[\s\-]", "", m.group(1))
                        if re.search(r"^\+?[\d]{8,15}$", p):
                            listing_agent_phone = p if p.startswith("+") else (f"+65{p}" if len(p) == 8 and p[0] in "89" else p)
                            break
            # 4. 中介姓名
            agent_selectors = [
                '[data-automation-id*="agent"]',
                '[data-automation-id*="listing-agent"]',
                '[class*="listing-agent"]',
                '[class*="agent-name"]',
                '[class*="contact-agent"]',
                'a[href*="/agent/"]',
                '[class*="seller"]',
            ]
            for sel in agent_selectors:
                try:
                    el = page.locator(sel).first
                    txt = await el.text_content(timeout=500)
                    if txt and 2 <= len(txt.strip()) <= 80 and not re.search(r"^[\d\+]+$", txt.strip()):
                        listing_agent_name = txt.strip()
                        break
                except Exception:
                    pass

            listing_type = _detect_listing_type(url, body)
            # 地契仅对出售房源有意义，租房不抓取
            # 优先从 Property Guru 小区项目页抓取 tenure（更准确，避免页面中「永久居民」等误判）
            lease_tenure: Optional[str] = None
            top_year: Optional[str] = None
            if listing_type == "sale":
                project_url: Optional[str] = None
                if "propertyguru" in url.lower() or "propertygroup" in url.lower():
                    try:
                        proj_link = page.locator('a[href*="/project/"]').first
                        if await proj_link.count() > 0:
                            href = await proj_link.get_attribute("href")
                            if href:
                                base = "https://www.propertyguru.com.sg" if "propertyguru" in url.lower() else "https://www.propertygroup.com.sg"
                                project_url = href if href.startswith("http") else f"{base}{href.split('?')[0]}"
                    except Exception:
                        pass
                if project_url:
                    try:
                        project_page = await context.new_page()
                        await project_page.goto(project_url, wait_until="load", timeout=15000)
                        await project_page.wait_for_timeout(1500)
                        # 从项目页 #details 表格抓取 Tenure
                        # 用户提供的 selector: #details > div > div.listing-details-primary > table > tbody:nth-child(4) > tr > td.label-block > h4
                        # 遍历表格行，找到含 "Tenure" 标签的那行，取其值所在单元格
                        tenure_raw: Optional[str] = None
                        for sel in [
                            "#details .listing-details-primary table tr",
                            "#details div.listing-details-primary table tbody tr",
                            "div.listing-details-primary table tr",
                        ]:
                            try:
                                rows = await project_page.locator(sel).all()
                                for tr in rows:
                                    txt = await tr.text_content()
                                    if txt and "tenure" in txt.lower():
                                        tds = tr.locator("td")
                                        n = await tds.count()
                                        for i in range(n):
                                            cell_txt = (await tds.nth(i).text_content() or "").strip()
                                            if cell_txt and "tenure" not in cell_txt.lower() and len(cell_txt) < 80:
                                                tenure_raw = cell_txt
                                                break
                                        if tenure_raw:
                                            break
                                if tenure_raw:
                                    break
                            except Exception:
                                continue
                        # 从项目页抓取 TOP 年份（入伙年份）
                        top_year_raw: Optional[str] = None
                        for sel in [
                            "#details .listing-details-primary table tr",
                            "#details div.listing-details-primary table tbody tr",
                            "div.listing-details-primary table tr",
                        ]:
                            try:
                                rows = await project_page.locator(sel).all()
                                for tr in rows:
                                    txt = await tr.text_content()
                                    if txt and ("top" in txt.lower() or "completion" in txt.lower() or "built" in txt.lower()):
                                        tds = tr.locator("td")
                                        n = await tds.count()
                                        for i in range(n):
                                            cell_txt = (await tds.nth(i).text_content() or "").strip()
                                            if cell_txt and ("top" not in cell_txt.lower() and "completion" not in cell_txt.lower() and "built" not in cell_txt.lower()):
                                                m = re.search(r"\b(19|20)\d{2}\b", cell_txt)
                                                if m:
                                                    top_year_raw = m.group(0)
                                                    break
                                        if top_year_raw:
                                            break
                                if top_year_raw:
                                    break
                            except Exception:
                                continue

                        await project_page.close()
                        if tenure_raw:
                            lease_tenure = _normalize_tenure_text(tenure_raw)
                        if top_year_raw:
                            top_year = top_year_raw
                    except Exception:
                        pass
                if not lease_tenure:
                    lease_tenure = _detect_lease_tenure(body)

            # 从 99.co 抓取公寓 site plan（best-effort，失败不影响主流程）
            site_plan_url: Optional[str] = None
            apt_name = _extract_apartment_name(title)
            if apt_name:
                try:
                    slug = _apartment_name_to_slug(apt_name)
                    plan_url = f"https://www.99.co/singapore/condos-apartments/{slug}#site_plans"
                    plan_page = await context.new_page()
                    await plan_page.goto(plan_url, wait_until="load", timeout=15000)
                    await plan_page.wait_for_timeout(2500)
                    await plan_page.evaluate(
                        """() => {
                        const el = document.querySelector('#site_plans');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }"""
                    )
                    await plan_page.wait_for_timeout(1500)
                    for sel in [
                        "#site_plans img.CarouselPhoto_image__06711",
                        "#site_plans .CarouselPhoto_imageContainer__WOp2O img",
                        "#site_plans img[src*='pic2.99.co']",
                        "#site_plans img",
                    ]:
                        if await plan_page.locator(sel).count() > 0:
                            img = plan_page.locator(sel).first
                            src = await img.get_attribute("src")
                            if src and "pic2.99.co" in src:
                                site_plan_url = src
                                break
                    await plan_page.close()
                except Exception:
                    pass

            await browser.close()

            return ScrapeResponse(
                title=title,
                link=url,
                price=price,
                price_value=price_value,
                price_description=price_description,
                size_sqft=size_sqft,
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                main_image_url=main_image_url,
                image_urls=image_urls[:2] if image_urls else None,
                floor_plan_url=floor_plan_url,
                basic_info=basic_info,
                listing_agent_name=listing_agent_name,
                listing_agent_phone=listing_agent_phone,
                listing_type=listing_type,
                lease_tenure=lease_tenure,
                top_year=top_year,
                site_plan_url=site_plan_url,
            )

        except Exception as e:
            await browser.close()
            raise HTTPException(status_code=500, detail=f"抓取失败: {str(e)}")


def _validate_scrape_url(url: str) -> None:
    allowed = ("propertyguru.com.sg", "propertyguru.com", "propertygroup.com.sg", "propertygroup.com")
    if not any(a in url for a in allowed):
        raise HTTPException(status_code=400, detail="仅支持 Property Guru / Property Group 链接")


# 限流状态：进行中的抓取 key -> 开始时间戳
_scrape_in_progress: dict[str, float] = {}
_scrape_lock = Lock()
SCRAPE_COOLDOWN_SEC = 3600  # 1 小时

# 全局 Rate limit：IP -> [(timestamp, count in window)]
_rate_limit: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # 秒
RATE_LIMIT_SCRAPE_PROPERTY = 15  # 同步抓取每 IP 每分钟
RATE_LIMIT_TRIGGER_SCRAPE = 30  # 异步触发每 IP 每分钟


def _check_rate_limit(ip: str, limit: int) -> bool:
    """True 表示通过，False 表示超限"""
    now = time.time()
    with _scrape_lock:
        if ip not in _rate_limit:
            _rate_limit[ip] = []
        times = _rate_limit[ip]
        times[:] = [t for t in times if now - t < RATE_LIMIT_WINDOW]
        if len(times) >= limit:
            return False
        times.append(now)
        return True


def _check_and_mark_in_progress(key: str) -> bool:
    """若已有进行中的同 key 抓取，返回 False；否则标记并返回 True"""
    with _scrape_lock:
        now = time.time()
        if key in _scrape_in_progress:
            return False
        _scrape_in_progress[key] = now
        return True


def _clear_in_progress(key: str) -> None:
    with _scrape_lock:
        _scrape_in_progress.pop(key, None)


def _get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@app.post("/api/scrape-property", response_model=ScrapeResponse)
async def scrape_property(req: ScrapeRequest, request: Request):
    """同步抓取，用于刷新按钮（用户等待结果）"""
    if not _check_rate_limit(_get_client_ip(request), RATE_LIMIT_SCRAPE_PROPERTY):
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
    url = _normalize_propertyguru_url(req.url)
    _validate_scrape_url(url)
    if not _check_and_mark_in_progress(f"url:{url}"):
        raise HTTPException(status_code=429, detail="你点得太快了，请稍后再点")
    try:
        return await _run_property_scraper(url)
    finally:
        _clear_in_progress(f"url:{url}")


def _get_supabase_client():
    """获取 Supabase 客户端（service role，用于后台更新）"""
    try:
        from supabase import create_client
    except ImportError:
        return None
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def _record_scrape_failure(property_id: str, url: str, error: Exception) -> None:
    """将抓取失败记录写入 scrape_failures 表，供管理员查看"""
    client = _get_supabase_client()
    if not client:
        return
    error_type = type(error).__name__
    if isinstance(error, TimeoutError):
        error_type = "timeout"
    try:
        client.table("scrape_failures").insert({
            "property_id": property_id,
            "source_url": url,
            "error_message": str(error),
            "error_type": error_type,
        }).execute()
    except Exception:
        import logging
        logging.getLogger(__name__).exception("写入 scrape_failures 失败")


async def _background_scrape_and_update(property_id: str, url: str) -> None:
    """后台执行抓取，成功后更新 Supabase properties 表；失败时写入 scrape_failures"""
    try:
        result = await _run_property_scraper(url)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("异步抓取失败: %s", e)
        _record_scrape_failure(property_id, url, e)
        return
    finally:
        _clear_in_progress(f"prop:{property_id}")
    client = _get_supabase_client()
    if not client:
        import logging
        logging.getLogger(__name__).warning("未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，无法写入数据库")
        return
    from datetime import datetime, timezone

    payload = {
        "title": result.title,
        "link": result.link,
        "basic_info": result.basic_info,
        "price": result.price,
        "price_value": result.price_value,
        "price_description": result.price_description,
        "size_sqft": result.size_sqft,
        "bedrooms": result.bedrooms,
        "bathrooms": result.bathrooms,
        "main_image_url": result.main_image_url,
        "image_urls": result.image_urls,
        "floor_plan_url": result.floor_plan_url,
        "listing_agent_name": result.listing_agent_name,
        "listing_agent_phone": result.listing_agent_phone,
        "listing_type": result.listing_type,
        "lease_tenure": result.lease_tenure,
        "top_year": result.top_year,
        "site_plan_url": result.site_plan_url,
        "last_scraped_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # 过滤掉 None 值，保留空字符串等
    payload = {k: v for k, v in payload.items() if v is not None}
    try:
        client.table("properties").update(payload).eq("id", property_id).execute()
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("更新数据库失败: %s", e)


def _is_property_scraped_recently(property_id: str) -> bool:
    """检查该房源是否在 1 小时内已抓取过"""
    client = _get_supabase_client()
    if not client:
        return False
    try:
        r = client.table("properties").select("last_scraped_at").eq("id", property_id).maybe_single().execute()
        if not r.data or not r.data.get("last_scraped_at"):
            return False
        from datetime import datetime, timezone
        last = r.data["last_scraped_at"]
        if isinstance(last, str):
            last_ts = datetime.fromisoformat(last.replace("Z", "+00:00")).timestamp()
        else:
            return False
        return (time.time() - last_ts) < SCRAPE_COOLDOWN_SEC
    except Exception:
        return False


@app.post("/api/trigger-scrape")
async def trigger_scrape(req: TriggerScrapeRequest, request: Request, background_tasks: BackgroundTasks):
    """异步触发抓取：立即返回 202，后台抓取完成后写入数据库。
    若同房源 1 小时内已抓取，返回 202 但不实际执行。"""
    from fastapi.responses import Response

    if not _check_rate_limit(_get_client_ip(request), RATE_LIMIT_TRIGGER_SCRAPE):
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
    url = _normalize_propertyguru_url(req.url)
    _validate_scrape_url(url)
    prop_key = f"prop:{req.property_id}"
    if not _check_and_mark_in_progress(prop_key):
        raise HTTPException(status_code=429, detail="你点得太快了，请稍后再点")
    if _is_property_scraped_recently(req.property_id):
        _clear_in_progress(prop_key)
        return Response(status_code=202, content=b"", media_type="text/plain")
    background_tasks.add_task(_background_scrape_and_update, req.property_id, url)
    return Response(status_code=202, content=b"", media_type="text/plain")


@app.post("/api/scrape-site-plan", response_model=SitePlanResponse)
async def scrape_site_plan(req: SitePlanRequest):
    """从 99.co 抓取公寓的 site plan 图片"""
    apartment_name = req.apartment_name.strip()
    if not apartment_name:
        raise HTTPException(status_code=400, detail="公寓名称不能为空")

    slug = _apartment_name_to_slug(apartment_name)
    url = f"https://www.99.co/singapore/condos-apartments/{slug}#site_plans"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="load", timeout=30000)
            await page.wait_for_timeout(3000)

            # 先滚动到 #site_plans 确保加载
            await page.evaluate(
                """() => {
                const el = document.querySelector('#site_plans');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }"""
            )
            await page.wait_for_timeout(2000)

            # 选择器：site_plans 区域内的 CarouselPhoto 图片
            selectors = [
                "#site_plans img.CarouselPhoto_image__06711",
                "#site_plans .CarouselPhoto_imageContainer__WOp2O img",
                "#site_plans img[src*='pic2.99.co']",
                "#site_plans img",
            ]
            site_plan_url: Optional[str] = None
            for sel in selectors:
                try:
                    if await page.locator(sel).count() > 0:
                        img = page.locator(sel).first
                        src = await img.get_attribute("src")
                        if src and "pic2.99.co" in src:
                            site_plan_url = src
                            break
                except Exception:
                    pass

            await browser.close()

            if not site_plan_url:
                raise HTTPException(
                    status_code=404,
                    detail=f"未找到该公寓的 site plan，请确认 99.co 上存在：{apartment_name}",
                )

            return SitePlanResponse(site_plan_url=site_plan_url)

        except HTTPException:
            await browser.close()
            raise
        except Exception as e:
            await browser.close()
            raise HTTPException(status_code=500, detail=f"抓取 site plan 失败: {str(e)}")
