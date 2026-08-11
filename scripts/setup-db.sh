#!/bin/bash
set +x
exec 2>&1
sudo -u postgres psql -c "SELECT 1 AS ok;"
sudo -u postgres psql -c "CREATE USER strengthlab WITH PASSWORD 'strengthlab' CREATEDB;" 2>&1 || true
sudo -u postgres psql -c "CREATE DATABASE strengthlab OWNER strengthlab;" 2>&1 || true
PGPASSWORD=strengthlab psql -h 127.0.0.1 -U strengthlab -d strengthlab -c "SELECT current_database();"
