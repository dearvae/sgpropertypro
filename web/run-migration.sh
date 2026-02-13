#!/bin/bash
# 仅执行 007 迁移（房源抓取字段），不依赖 Supabase 迁移历史
# 用法: 在项目根 .env 中设置 SUPABASE_PROJECT_REF、SUPABASE_DB_PASSWORD，或通过环境变量传入
# 若存在 ../.env 则自动加载

set -e
cd "$(dirname "$0")"
if [ -f "../.env" ]; then
  set -a
  source "../.env"
  set +a
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "请设置环境变量 SUPABASE_DB_PASSWORD（在 .env 或环境变量）"
  exit 1
fi
if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "请设置环境变量 SUPABASE_PROJECT_REF（在 .env 或环境变量）"
  exit 1
fi

python3 run-migration-007.py
