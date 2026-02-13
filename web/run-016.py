#!/usr/bin/env python3
"""执行 016_allow_appointment_conflicts：移除冲突检测触发器"""
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

    sql = 'drop trigger if exists before_appointment_insert_update on public.appointments;'
    print('正在移除预约冲突检测触发器...')
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print('完成，现已允许同一时段保存多个预约')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
