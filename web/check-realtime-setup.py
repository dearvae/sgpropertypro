#!/usr/bin/env python3
"""检查 pending_appointments 是否在 supabase_realtime 中"""
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
        print('请设置 SUPABASE_DB_PASSWORD', file=sys.stderr)
        sys.exit(1)
    try:
        import psycopg2
    except ImportError:
        print('请先安装: pip install psycopg2-binary', file=sys.stderr)
        sys.exit(1)
    from urllib.parse import quote
    project_ref = os.environ.get('SUPABASE_PROJECT_REF')
    if not project_ref:
        print('请设置 SUPABASE_PROJECT_REF', file=sys.stderr)
        sys.exit(1)
    encoded = quote(password, safe='')
    conn_str = f'postgresql://postgres:{encoded}@db.{project_ref}.supabase.co:5432/postgres'
    conn = psycopg2.connect(conn_str)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                select pubname, schemaname, tablename
                from pg_publication_tables
                where pubname = 'supabase_realtime'
                order by tablename
            """)
            rows = cur.fetchall()
            has_pending = any(r[2] == 'pending_appointments' for r in rows)
            print('supabase_realtime 中的表:', [r[2] for r in rows])
            if has_pending:
                print('✓ pending_appointments 已在 Realtime 中')
            else:
                print('✗ pending_appointments 未在 Realtime 中，正在添加...')
                cur.execute("alter publication supabase_realtime add table public.pending_appointments")
                conn.commit()
                print('已添加')
    finally:
        conn.close()

if __name__ == '__main__':
    main()
