#!/bin/bash
# Create missing dev databases. Idempotent.
# Postgres runs this from docker-entrypoint-initdb.d on an empty volume.
# The postgres-init service runs it on every ./start.sh.
set -euo pipefail

# Single list. dev/compose_env.test.mjs checks it against *_POSTGRES_DATABASE_URL.
DATABASES=(
  identity
  identity_global
  storage
  hosting
  email
  saas
  ai
)

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

if [[ -z "${PGPASSWORD:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then
  export PGPASSWORD="${POSTGRES_PASSWORD}"
fi

values=""
for db in "${DATABASES[@]}"; do
  if [[ ! "${db}" =~ ^[a-z][a-z0-9_]*$ ]]; then
    echo "invalid database name: ${db}" >&2
    exit 1
  fi
  if [[ -n "${values}" ]]; then
    values+=", "
  fi
  values+="('${db}')"
done

echo "Ensuring Postgres databases: ${DATABASES[*]}"

# \gexec runs each SELECT cell as its own statement, so CREATE DATABASE
# is not inside a transaction. NOT EXISTS makes a second run a no-op.
psql --no-psqlrc -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<SQL
SELECT format('CREATE DATABASE %I', datname)
FROM (VALUES ${values}) AS wanted(datname)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE pg_database.datname = wanted.datname
)
\gexec
SQL
