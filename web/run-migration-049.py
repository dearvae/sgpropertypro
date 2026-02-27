#!/usr/bin/env python3
"""
执行 049 迁移：将时长 30 分钟的预约改为 15 分钟
用法: cd propertyassistance && python3 web/run-migration-049.py
需在 .env 中配置 SUPABASE_PROJECT_REF、SUPABASE_DB_PASSWORD
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
    sql_path = script_dir / 'supabase' / 'migrations' / '049_appointment_30min_to_15min.sql'
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    print('正在执行 049 迁移（30 分钟预约 → 15 分钟）...')
    conn = psycopg2.connect(conn_str)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, start_time, end_time FROM public.appointments "
                "WHERE end_time - start_time = interval '30 minutes' AND status != 'cancelled'"
            )
            rows = cur.fetchall()
        if rows:
            print(f'将更新 {len(rows)} 条预约', file=sys.stderr)
        with conn.cursor() as cur:
            cur.execute(sql)
            updated = cur.rowcount
        conn.commit()
        print(f'完成，已更新 {updated} 条预约')
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    main()
