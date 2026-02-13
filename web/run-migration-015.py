#!/usr/bin/env python3
"""
执行 015 迁移（待预约 pending_appointments 表）
用法: 在项目根 .env 中设置 SUPABASE_PROJECT_REF、SUPABASE_DB_PASSWORD，或通过环境变量传入
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
        print('请设置环境变量 SUPABASE_DB_PASSWORD', file=sys.stderr)
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

    script_dir = os.path.dirname(os.path.abspath(__file__))
    sql_path = os.path.join(script_dir, 'supabase', 'migrations', '015_pending_appointments.sql')
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print('正在执行 015 迁移（待预约 pending_appointments）...')
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print('015 迁移完成')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
