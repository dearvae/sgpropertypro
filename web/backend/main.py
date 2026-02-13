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


class ScrapeResponse(BaseModel):
    title: str
    link: str
    price: Optional[str] = None
    size_sqft: Optional[str] = None
    bedrooms: Optional[str] = None
    bathrooms: Optional[str] = None
    main_image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None  # 前两张房源图
    floor_plan_url: Optional[str] = None
    basic_info: Optional[str] = None
    listing_agent_name: Optional[str] = None  # 卖家中介姓名
    listing_agent_phone: Optional[str] = None  # 卖家中介电话
    listing_type: Optional[str] = None  # 'sale' | 'rent' 出售 vs 出租


def _normalize_propertyguru_url(url: str) -> str:
    """统一 Property Guru 链接格式，便于去重"""
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    return url.rstrip("/")


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

            # 收集前两张房源图（排除户型图）
            og_image = await page.evaluate(
                """() => {
                const m = document.querySelector('meta[property="og:image"]');
                return m ? m.getAttribute('content') : '';
            }"""
            )
            imgs = await page.locator(
                'img[src*="pgimgs"], img[src*="propertyguru"], [class*="gallery"] img, [class*="carousel"] img'
            ).all()
            for img in imgs[:8]:
                src = await img.get_attribute("src")
                if src and ("floor" not in src.lower() and "plan" not in src.lower()) and src not in image_urls:
                    if len(image_urls) < 2:
                        image_urls.append(src)
                    if not main_image_url:
                        main_image_url = src
            if og_image and not main_image_url:
                main_image_url = og_image
            if og_image and len(image_urls) < 2 and og_image not in image_urls:
                image_urls.insert(0, og_image)

            # Floor plan: 含 floor/plan 的图
            floor_imgs = await page.locator(
                'img[src*="floor"], img[src*="plan"], [alt*="floor" i] img, [alt*="plan" i] img'
            ).all()
            for img in floor_imgs[:3]:
                src = await img.get_attribute("src")
                if src:
                    floor_plan_url = src
                    break

            # 卖家中介：姓名与电话（Property Guru 常见结构）
            listing_agent_name: Optional[str] = None
            listing_agent_phone: Optional[str] = None
            tel_links = await page.locator('a[href^="tel:"]').all()
            for tel in tel_links[:5]:
                href = await tel.get_attribute("href")
                if href:
                    phone = href.replace("tel:", "").strip().replace(" ", "").replace("-", "")
                    if re.search(r"^\+?[\d]{8,15}$", phone):
                        listing_agent_phone = phone
                        break
            if not listing_agent_phone:
                tel_match = re.search(r'tel:(\+?[\d\s\-]{8,20})', body)
                if tel_match:
                    listing_agent_phone = re.sub(r"[\s\-]", "", tel_match.group(1))
            agent_selectors = [
                '[data-automation-id*="agent"]',
                '[data-automation-id*="listing-agent"]',
                '[class*="listing-agent"]',
                '[class*="agent-name"]',
                'a[href*="/agent/"]',
            ]
            for sel in agent_selectors:
                try:
                    el = page.locator(sel).first
                    txt = await el.text_content(timeout=500)
                    if txt and len(txt.strip()) > 1 and len(txt.strip()) < 80:
                        listing_agent_name = txt.strip()
                        break
                except Exception:
                    pass

            listing_type = _detect_listing_type(url, body)

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
            )

        except Exception as e:
            await browser.close()
            raise HTTPException(status_code=500, detail=f"抓取失败: {str(e)}")
