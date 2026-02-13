"""
Property Guru 房源抓取 API
POST /api/scrape-property 传入 URL，返回抓取到的房源信息
"""
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright

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


class SitePlanRequest(BaseModel):
    apartment_name: str


class SitePlanResponse(BaseModel):
    site_plan_url: str


class ScrapeResponse(BaseModel):
    title: str
    link: str
    price: Optional[str] = None
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
    site_plan_url: Optional[str] = None  # 公寓小区平面图，从 99.co 抓取


def _normalize_propertyguru_url(url: str) -> str:
    """统一 Property Guru 链接格式，便于去重"""
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    return url.rstrip("/")


def _detect_lease_tenure(body: str) -> Optional[str]:
    """从页面内容识别地契/租期，仅对出售房源有意义"""
    body_lower = body.lower()
    # 永久/Freehold 优先
    if re.search(r"freehold|永久|永久地契", body_lower):
        return "永久地契"
    # 999 必须先于 99 检查，避免误判
    if re.search(r"999\s*[- ]?year|999\s*年|999年地契", body_lower):
        return "999年地契"
    if re.search(r"\b99\s*[- ]?year|\b99\s*年|99年地契|leasehold", body_lower):
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


@app.post("/api/scrape-property", response_model=ScrapeResponse)
async def scrape_property(req: ScrapeRequest):
    url = _normalize_propertyguru_url(req.url)
    if "propertyguru.com.sg" not in url and "propertyguru.com" not in url:
        raise HTTPException(status_code=400, detail="仅支持 Property Guru 链接")

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

            title = ""
            price: Optional[str] = None
            size_sqft: Optional[str] = None
            bedrooms: Optional[str] = None
            bathrooms: Optional[str] = None
            main_image_url: Optional[str] = None
            image_urls: list[str] = []
            floor_plan_url: Optional[str] = None
            basic_info_parts: list[str] = []

            # Title: og:title 或 h1
            og_title = await page.evaluate(
                """() => {
                const m = document.querySelector('meta[property="og:title"]');
                return m ? m.getAttribute('content') : '';
            }"""
            )
            if og_title:
                title = og_title

            if not title:
                h1 = await page.locator("h1").first.text_content()
                if h1:
                    title = h1.strip()

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
            lease_tenure = None
            if listing_type == "sale":
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
                site_plan_url=site_plan_url,
            )

        except Exception as e:
            await browser.close()
            raise HTTPException(status_code=500, detail=f"抓取失败: {str(e)}")


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
