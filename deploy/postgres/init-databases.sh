#!/bin/sh
# Create one database and role per service. Runs only on a new Postgres volume.
# Passwords are hex from generate-secrets.sh, so they are safe to embed in SQL.
set -eu

if [ -z "${IDENTITY_DB_PASSWORD:-}" ] || [ -z "${STORAGE_DB_PASSWORD:-}" ] || [ -z "${HOSTING_DB_PASSWORD:-}" ] || [ -z "${EMAIL_DB_PASSWORD:-}" ]; then
  echo "init-databases: database passwords are missing" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOF
CREATE USER identity WITH PASSWORD '${IDENTITY_DB_PASSWORD}';
CREATE DATABASE identity OWNER identity;
CREATE USER storage WITH PASSWORD '${STORAGE_DB_PASSWORD}';
CREATE DATABASE storage OWNER storage;
CREATE USER hosting WITH PASSWORD '${HOSTING_DB_PASSWORD}';
CREATE DATABASE hosting OWNER hosting;
CREATE USER email WITH PASSWORD '${EMAIL_DB_PASSWORD}';
CREATE DATABASE email OWNER email;
EOF
