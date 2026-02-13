#!/usr/bin/env python3
"""执行 20250214_site_plan_url：添加 site_plan_url 列、更新 get_client_view"""
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

def main():
    password = os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        print('请设置 SUPABASE_DB_PASSWORD（在 .env 或环境变量）', file=sys.stderr)
        sys.exit(1)
    project_ref = os.environ.get('SUPABASE_PROJECT_REF')
    if not project_ref:
        print('请设置 SUPABASE_PROJECT_REF', file=sys.stderr)
        sys.exit(1)
    try:
        from urllib.parse import quote
        encoded = quote(password, safe='')
    except ImportError:
        encoded = password
    conn_str = f'postgresql://postgres:{encoded}@db.{project_ref}.supabase.co:5432/postgres'

    try:
        import psycopg2
    except ImportError:
        print('请先安装: pip install psycopg2-binary', file=sys.stderr)
        sys.exit(1)

    script_dir = Path(__file__).resolve().parent
    sql_path = script_dir / 'supabase' / 'migrations' / '20250214_site_plan_url.sql'
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print('正在执行 20250214_site_plan_url（添加 site_plan_url、更新 get_client_view）...')
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print('完成')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
