#!/usr/bin/env python3
"""
执行 048 迁移：ClientView 返回 group_type、property_id 及 appointment 的 customer_info、customer_phone、party_role
用法: python3 run-migration-048.py 或 SUPABASE_DB_PASSWORD=密码 python3 run-migration-048.py
"""
import os
import sys
from pathlib import Path

def load_env():
    script_dir = Path(__file__).resolve().parent
    try:
        from dotenv import load_dotenv
        for p in [script_dir.parent / '.env', script_dir / '.env']:
            if p.exists():
                load_dotenv(p)
                break
    except ImportError:
        pass

load_env()

def url_encode_password(password: str) -> str:
    from urllib.parse import quote
    return quote(password, safe='')

def main():
    password = os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        print('请设置 SUPABASE_DB_PASSWORD', file=sys.stderr)
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
    encoded = url_encode_password(password)
    conn_str = f'postgresql://postgres:{encoded}@db.{project_ref}.supabase.co:5432/postgres'
    script_dir = Path(__file__).resolve().parent
    sql_path = script_dir / 'supabase' / 'migrations' / '048_client_view_listing_fields.sql'
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    print('正在执行 048 迁移（get_client_view 返回 group_type、property_id、customer_info 等）...')
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        with conn.cursor() as cur:
            cur.execute("NOTIFY pgrst, 'reload schema';")
        print('完成，已刷新 schema 缓存')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
