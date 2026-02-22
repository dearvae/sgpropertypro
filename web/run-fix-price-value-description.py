#!/usr/bin/env python3
"""
从 price 分割数字和文字，更新 price_value 和 price_description。
- 数字部分 -> price_value（纯数字，如 1888000）
- 文字部分 -> price_description（如 Negotiable、Starting from、POA 等）

用法: cd propertyassistance/web && python3 run-fix-price-value-description.py
需要: SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF（来自 .env）
"""
import os
import re
import sys
from pathlib import Path
from typing import Optional

def load_env():
    script_dir = Path(__file__).resolve().parent
    try:
        from dotenv import load_dotenv
        for p in [script_dir.parent.parent / '.env', script_dir.parent / '.env', script_dir / '.env']:
            if p.exists():
                load_dotenv(p)
                break
    except ImportError:
        pass

load_env()


def _extract_numeric_value(price_str: str) -> Optional[str]:
    """从价格字符串提取纯数字，如 'S$ 1,888,000' -> '1888000'，'1.5M' -> '1500000'"""
    if not price_str or not price_str.strip():
        return None
    s = price_str.strip()
    s = re.sub(r"[S\$€£¥\s]+", "", s, flags=re.I)
    s = s.replace(",", "")
    for pattern, multiplier in [
        (r"([\d.]+)\s*m(?:illion)?", 1_000_000),
        (r"([\d.]+)\s*k(?: thousand)?", 1_000),
    ]:
        m = re.search(pattern, s, re.I)
        if m:
            try:
                num = float(m.group(1)) * multiplier
                return str(int(num))
            except (ValueError, IndexError):
                pass
    m = re.search(r"[\d.]+", s)
    if m:
        raw = m.group(0)
        try:
            val = float(raw)
            return str(int(val)) if val == int(val) else str(int(val))
        except ValueError:
            return None
    return None


def _parse_price_into_value_and_description(price_text: str) -> tuple[Optional[str], Optional[str]]:
    """将完整价格文本拆分为纯数字和描述"""
    if not price_text or not price_text.strip():
        return None, None
    text = price_text.strip()
    text_lower = text.lower()
    value_raw: Optional[str] = None
    desc_name: Optional[str] = None
    for pattern, d in [(r"\s*negotiable\b", "Negotiable"), (r"\s*poa\b", "POA")]:
        m = re.search(pattern, text_lower, re.I)
        if m:
            value_raw = re.sub(pattern, "", text, flags=re.I).strip()
            desc_name = d
            break
    if not desc_name:
        for pattern, d in [
            (r"\bprice on request\b", "Price on request"),
            (r"\bcall for price\b", "Call for price"),
            (r"\bcontact for price\b", "Contact for price"),
        ]:
            m = re.search(pattern, text_lower, re.I)
            if m:
                value_raw = re.sub(pattern, " ", text, flags=re.I)
                value_raw = " ".join(value_raw.split()).strip()
                desc_name = d
                break
    if not desc_name:
        for pattern, d in [
            (r"^\s*starting\s+from\s+", "Starting from"),
            (r"^\s*from\s+", "From"),
        ]:
            m = re.search(pattern, text_lower, re.I)
            if m:
                value_raw = re.sub(pattern, "", text, flags=re.I).strip()
                desc_name = d
                break
    if value_raw is None and desc_name is None:
        value_raw = text
    price_value = _extract_numeric_value(value_raw) if value_raw else None
    return price_value, desc_name


def main():
    password = os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        print('请设置 SUPABASE_DB_PASSWORD（在 .env 或环境变量）', file=sys.stderr)
        sys.exit(1)
    try:
        import psycopg2
    except ImportError:
        print('请先安装: pip install psycopg2-binary', file=sys.stderr)
        sys.exit(1)
    project_ref = os.environ.get('SUPABASE_PROJECT_REF')
    if not project_ref:
        print('请设置 SUPABASE_PROJECT_REF（在 .env 或环境变量）', file=sys.stderr)
        sys.exit(1)
    from urllib.parse import quote
    encoded = quote(password, safe='')
    conn_str = f'postgresql://postgres:{encoded}@db.{project_ref}.supabase.co:5432/postgres'

    conn = psycopg2.connect(conn_str)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, price FROM public.properties WHERE price IS NOT NULL AND trim(price) != ''")
            rows = cur.fetchall()
        print(f'找到 {len(rows)} 条有 price 的房源，正在更新...')
        updated = 0
        for pid, price in rows:
            pv, pd = _parse_price_into_value_and_description(price or '')
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE public.properties SET price_value = %s, price_description = %s WHERE id = %s",
                    (pv, pd, pid)
                )
            updated += 1
            if updated % 50 == 0 and updated > 0:
                print(f'  已处理 {updated}/{len(rows)} 条')
        conn.commit()
        print(f'完成，已更新 {updated} 条记录。')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
