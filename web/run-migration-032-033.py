#!/usr/bin/env python3
"""
执行 032、033 迁移：
  032 - properties 添加 top_year 列（TOP 年份/入伙年份）
  033 - get_client_view 函数返回 top_year

用法: python3 run-migration-032-033.py 或 SUPABASE_DB_PASSWORD=密码 python3 run-migration-032-033.py
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
    migrations_dir = script_dir / 'supabase' / 'migrations'

    print('正在执行 032 迁移（properties.top_year）...')
    with open(migrations_dir / '032_property_top_year.sql', 'r', encoding='utf-8') as f:
        sql_032 = f.read()

    print('正在执行 033 迁移（get_client_view 返回 top_year）...')
    with open(migrations_dir / '033_client_view_top_year.sql', 'r', encoding='utf-8') as f:
        sql_033 = f.read()

    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql_032)
            cur.execute(sql_033)
            # 刷新 PostgREST schema cache，否则会出现 "Could not find the 'top_year' column" 错误
            cur.execute("NOTIFY pgrst, 'reload schema';")
        print('完成（已发送 schema 刷新通知）')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
