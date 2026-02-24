#!/usr/bin/env python3
"""
执行 047 迁移：scrape_failures / scrape_runs 表增加 error_log 列，RPC 返回 error_log
用法: python3 run-migration-047.py 或 SUPABASE_DB_PASSWORD=密码 python3 run-migration-047.py
"""
import os
import sys
from pathlib import Path

def _load_env_file(path: Path) -> None:
    """简单解析 KEY=value 格式的 .env 文件（不依赖 python-dotenv）"""
    if not path.exists():
        return
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, _, v = line.partition('=')
                k = k.strip()
                v = v.strip()
                if v and v[0] == v[-1] and v[0] in '"\'':
                    v = v[1:-1].replace('\\n', '\n')
                os.environ.setdefault(k, v)

def load_env():
    script_dir = Path(__file__).resolve().parent
    try:
        from dotenv import load_dotenv
        for p in [script_dir.parent / '.env', script_dir / '.env']:
            if p.exists():
                load_dotenv(p)
                return
    except ImportError:
        pass
    # 无 python-dotenv 时用内置解析
    for p in [script_dir.parent / '.env', script_dir / '.env']:
        _load_env_file(p)
        if os.environ.get('SUPABASE_DB_PASSWORD'):
            break

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
    sql_path = script_dir / 'supabase' / 'migrations' / '047_scrape_error_log.sql'
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    print('正在执行 047 迁移（scrape 表 error_log 列 + RPC 更新）...')
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
