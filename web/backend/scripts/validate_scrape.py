#!/usr/bin/env python3
"""
批量验证房源抓取：对给定 URL 列表执行抓取，输出成功/失败及错误信息。
用法:
  python scripts/validate_scrape.py "https://www.propertyguru.com.sg/listing/..."
  python scripts/validate_scrape.py --urls urls.txt
  python scripts/validate_scrape.py --urls urls.txt --output results.json
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

# 确保 backend 目录在 path 中
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from main import _run_property_scraper, _normalize_propertyguru_url, _validate_scrape_url


async def _scrape_one(url: str) -> tuple[bool, dict]:
    """抓取单个 URL，返回 (成功, 结果或错误信息)"""
    url = _normalize_propertyguru_url(url.strip())
    try:
        _validate_scrape_url(url)
    except Exception as e:
        return False, {"url": url, "error": str(e), "error_type": "validation"}

    try:
        result = await _run_property_scraper(url)
        return True, {
            "url": url,
            "title": result.title,
            "price": result.price,
            "main_image_url": result.main_image_url is not None,
            "image_count": len(result.image_urls or []),
        }
    except Exception as e:
        return False, {
            "url": url,
            "error": str(e),
            "error_type": type(e).__name__,
        }


async def main():
    parser = argparse.ArgumentParser(description="批量验证房源抓取")
    parser.add_argument("urls", nargs="*", help="URL 列表")
    parser.add_argument("--urls-file", dest="urls_file", help="从文件读取 URL，每行一个")
    parser.add_argument("--output", "-o", help="将结果写入 JSON 文件")
    args = parser.parse_args()

    urls = list(args.urls)
    if args.urls_file:
        p = Path(args.urls_file)
        if not p.exists():
            print(f"文件不存在: {p}", file=sys.stderr)
            sys.exit(1)
        urls.extend(p.read_text(encoding="utf-8").strip().splitlines())

    urls = [u.strip() for u in urls if u.strip()]
    if not urls:
        print("请提供 URL（命令行或 --urls-file）", file=sys.stderr)
        sys.exit(1)

    results = []
    for i, url in enumerate(urls):
        ok, data = await _scrape_one(url)
        results.append({"success": ok, **data})
        status = "OK" if ok else "FAIL"
        err = data.get("error", "")
        title = data.get("title", "")
        print(f"[{i+1}/{len(urls)}] {status} | {url[:60]}...")
        if ok:
            print(f"       title={title[:50]}... price={data.get('price', '-')}")
        else:
            print(f"       error={err[:80]}{'...' if len(err) > 80 else ''}")

    success_count = sum(1 for r in results if r["success"])
    print(f"\n总计: {success_count}/{len(results)} 成功")

    if args.output:
        out_path = Path(args.output)
        out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"结果已写入: {out_path}")

    sys.exit(0 if success_count == len(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
