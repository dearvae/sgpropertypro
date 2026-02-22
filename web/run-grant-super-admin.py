#!/usr/bin/env python3
"""
授予 lovevae7@gmail.com 超级管理员权限
用法: python3 run-grant-super-admin.py 或 SUPABASE_DB_PASSWORD=密码 python3 run-grant-super-admin.py
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
    sql_path = script_dir / 'supabase' / 'scripts' / 'grant_super_admin.sql'
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    # 只执行 update，跳过注释和 select 验证（select 在 psycopg2 中会返回结果，一起执行也可以）
    print('正在为 lovevae7@gmail.com 授予超级管理员权限...')
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("""
                update public.profiles
                set is_admin = true, is_super_admin = true, updated_at = now()
                where id = (select id from auth.users where email = 'lovevae7@gmail.com' limit 1);
            """)
            rows = cur.rowcount
        if rows > 0:
            print(f'完成！已更新 {rows} 条记录，lovevae7@gmail.com 现为超级管理员。')
        else:
            print('未找到 lovevae7@gmail.com 的对应用户/记录，请确认该邮箱已注册。', file=sys.stderr)
            sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
