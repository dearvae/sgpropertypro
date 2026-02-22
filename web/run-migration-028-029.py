#!/usr/bin/env python3
"""
执行 028 + 029 迁移：邀请码系统、is_admin、is_super_admin、admin_get_invite_relations RPC
用法: python3 run-migration-028-029.py 或 SUPABASE_DB_PASSWORD=密码 python3 run-migration-028-029.py
"""
import os
import sys
from pathlib import Path

def load_env():
    script_dir = Path(__file__).resolve().parent
    try:
        from dotenv import load_dotenv
        for p in [script_dir.parent / '.env', script_dir.parent.parent / '.env', script_dir / '.env']:
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
    encoded = url_encode_password(password)
    conn_str = f'postgresql://postgres:{encoded}@db.{project_ref}.supabase.co:5432/postgres'
    script_dir = Path(__file__).resolve().parent
    migrations_dir = script_dir / 'supabase' / 'migrations'

    # 028 依赖 phone 列（来自 profiles_extend），需先执行前置迁移
    migrations = [
        ('20250214_profiles_extend', '20250214_profiles_extend.sql', 'profiles 扩展：phone、full_name、agent_number'),
        ('023', '023_whatsapp_template_profiles.sql', 'profiles 公司名'),
        ('027', '027_profiles_family_given_name.sql', 'profiles 姓/名'),
        ('028', '028_invite_system_verification.sql', '邀请码、验证状态、is_admin、admin_get_invite_relations'),
        ('029', '029_is_super_admin.sql', 'is_super_admin'),
    ]

    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for name, filename, desc in migrations:
                path = migrations_dir / filename
                if not path.exists():
                    print(f'跳过 {name}：{filename} 不存在')
                    continue
                print(f'正在执行 {name}（{desc}）...')
                with open(path, 'r', encoding='utf-8') as f:
                    cur.execute(f.read())
                print(f'{name} 完成')
        print('全部完成')
    except Exception as e:
        print(f'错误: {e}', file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
