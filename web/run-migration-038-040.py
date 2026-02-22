#!/usr/bin/env python3
"""
执行 038、039、040 迁移：
  038 - pending_appointments 添加 client_feedback 列
  039 - save_client_pending_feedback RPC
  040 - get_client_view 返回 pending_appointments（客户页待预约）

用法: python3 run-migration-038-040.py 或 SUPABASE_DB_PASSWORD=密码 python3 run-migration-038-040.py
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

    migrations = [
        ('038', '038_pending_appointments_client_feedback.sql', 'client_feedback 列'),
        ('039', '039_save_client_pending_feedback.sql', 'save_client_pending_feedback RPC'),
        ('040', '040_get_client_view_pending.sql', 'get_client_view 返回 pending_appointments'),
    ]

    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for name, filename, desc in migrations:
                print(f'正在执行 {name} 迁移（{desc}）...')
                with open(migrations_dir / filename, 'r', encoding='utf-8') as f:
                    cur.execute(f.read())
        print('完成')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
