"""
房源抓取相关单元测试。
新增功能需补充对应测试，修改功能需同步更新测试。
"""
import pytest
from fastapi import HTTPException

from main import (
    _normalize_propertyguru_url,
    _validate_scrape_url,
    _is_generic_site_title,
    _parse_price_into_value_and_description,
    _apartment_name_to_slug,
    _extract_apartment_name,
)
from main import app

# 供 TestClient 使用
pytest_plugins = ["pytest_asyncio"]


# --- 纯函数单元测试 ---

class TestNormalizePropertyguruUrl:
    def test_adds_https(self):
        assert _normalize_propertyguru_url("www.propertyguru.com.sg/listing/123") == \
            "https://www.propertyguru.com.sg/listing/123"

    def test_strips_trailing_slash(self):
        assert _normalize_propertyguru_url("https://www.propertyguru.com.sg/listing/123/") == \
            "https://www.propertyguru.com.sg/listing/123"

    def test_preserves_https(self):
        url = "https://www.propertyguru.com.sg/listing/456"
        assert _normalize_propertyguru_url(url) == url

    def test_propertygroup(self):
        assert "propertygroup.com" in _normalize_propertyguru_url("propertygroup.com.sg/listing/1")


class TestValidateScrapeUrl:
    def test_propertyguru_com_sg_ok(self):
        _validate_scrape_url("https://www.propertyguru.com.sg/listing/123")

    def test_propertyguru_com_ok(self):
        _validate_scrape_url("https://www.propertyguru.com/listing/456")

    def test_propertygroup_com_sg_ok(self):
        _validate_scrape_url("https://www.propertygroup.com.sg/listing/789")

    def test_propertygroup_com_ok(self):
        _validate_scrape_url("https://www.propertygroup.com/listing/xyz")

    def test_unsupported_domain_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            _validate_scrape_url("https://www.example.com/listing/1")
        assert exc.value.status_code == 400
        assert "仅支持" in str(exc.value.detail)

    def test_99co_raises_400(self):
        with pytest.raises(HTTPException):
            _validate_scrape_url("https://www.99.co/singapore/listing/1")


class TestIsGenericSiteTitle:
    def test_domain_is_generic(self):
        assert _is_generic_site_title("www.propertyguru.com.sg") is True
        assert _is_generic_site_title("propertyguru.com") is True
        assert _is_generic_site_title("PropertyGroup.com") is True

    def test_listing_title_not_generic(self):
        assert _is_generic_site_title("Luxury 3BR at Marina Bay") is False
        assert _is_generic_site_title("2 Bedroom Condo - Orchard") is False

    def test_short_or_empty_generic(self):
        assert _is_generic_site_title("") is True
        assert _is_generic_site_title("ab") is True


class TestParsePriceIntoValueAndDescription:
    def test_negotiable(self):
        v, d = _parse_price_into_value_and_description("S$1,500,000 negotiable")
        assert "1" in (v or "") and "negotiable" == d

    def test_poa(self):
        v, d = _parse_price_into_value_and_description("POA")
        assert d == "POA"

    def test_starting_from(self):
        v, d = _parse_price_into_value_and_description("Starting from S$2M")
        assert d == "Starting from"

    def test_simple_price(self):
        v, d = _parse_price_into_value_and_description("S$800,000")
        assert v == "S$800,000"
        assert d is None


class TestApartmentNameHelpers:
    def test_extract_apartment_name_with_dash(self):
        assert _extract_apartment_name("Marina One - 2 Bedroom") == "Marina One"

    def test_extract_apartment_name_with_at(self):
        assert _extract_apartment_name("2 Bed at The Interlace") == "The Interlace"

    def test_apartment_name_to_slug(self):
        # _apartment_name_to_slug 会去掉 -residences 等后缀
        assert _apartment_name_to_slug("Marina One Residences") == "marina-one"
        assert _apartment_name_to_slug("The Interlace") == "the-interlace"


# --- API 集成测试 ---

@pytest.mark.asyncio
async def test_scrape_property_invalid_url_returns_400():
    """非支持域名应返回 400"""
    from httpx import ASGITransport, AsyncClient
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/scrape-property", json={"url": "https://www.example.com/list/1"})
    assert r.status_code == 400
    assert "仅支持" in (r.json().get("detail") or "")


@pytest.mark.asyncio
async def test_scrape_property_empty_url_returns_error():
    """空 URL 应返回 400（校验不通过）"""
    from httpx import ASGITransport, AsyncClient
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/scrape-property", json={"url": ""})
    assert r.status_code in (400, 422)


@pytest.mark.asyncio
async def test_trigger_scrape_invalid_url_returns_400():
    """trigger-scrape 非支持域名应返回 400"""
    from httpx import ASGITransport, AsyncClient
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post(
            "/api/trigger-scrape",
            json={"property_id": "00000000-0000-0000-0000-000000000001", "url": "https://example.com/1"}
        )
    assert r.status_code == 400
