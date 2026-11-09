#!/bin/bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<-EOSQL
	CREATE DATABASE identity;
	CREATE DATABASE identity_global;
	CREATE DATABASE storage;
	CREATE DATABASE hosting;
	CREATE DATABASE email;
	CREATE DATABASE saas;
	CREATE DATABASE ai;
EOSQL
