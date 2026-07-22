#!/bin/sh
# Generate a private CA + Postgres server certificate for Expentra Compose TLS.
# Run once per environment on the VPS (or a trusted machine), then place output under:
#   /opt/expentra-staging/certs/postgres/
#   /opt/expentra-production/certs/postgres/
#
# Usage:
#   ./generate-certs.sh [output_dir]
# Example:
#   sudo ./generate-certs.sh /opt/expentra-staging/certs/postgres
#
# Copy only ca.crt to operator laptops for TablePlus VERIFY_CA. Never commit keys.

set -eu

OUT_DIR="${1:-./out}"
DAYS_CA="${DAYS_CA:-3650}"
DAYS_SERVER="${DAYS_SERVER:-825}"
# Official postgres:15-alpine runs as uid 70
PG_UID="${PG_UID:-70}"
PG_GID="${PG_GID:-70}"

mkdir -p "${OUT_DIR}"
OUT_DIR="$(CDPATH= cd -- "${OUT_DIR}" && pwd)"
cd "${OUT_DIR}"

umask 077

if [ -f ca.crt ] && [ -f server.crt ] && [ -f server.key ]; then
  echo "Certs already exist in ${OUT_DIR} (ca.crt / server.crt / server.key)."
  echo "Delete them first if you intend to rotate."
  exit 0
fi

echo "Generating Postgres TLS material in ${OUT_DIR} ..."

# --- CA ---
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "${DAYS_CA}" \
  -subj "/CN=Expentra Postgres CA/O=Expentra" \
  -out ca.crt

# --- Server ---
openssl genrsa -out server.key 2048
openssl req -new -key server.key \
  -subj "/CN=postgres/O=Expentra" \
  -out server.csr

cat > server.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = postgres
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "${DAYS_SERVER}" -sha256 -extfile server.ext

rm -f server.csr server.ext ca.srl

chmod 600 ca.key server.key
chmod 644 ca.crt server.crt

# Postgres refuses world/group-readable keys; container user must own the key.
if command -v chown >/dev/null 2>&1; then
  chown "${PG_UID}:${PG_GID}" ca.key server.key ca.crt server.crt 2>/dev/null \
    || echo "Note: could not chown to ${PG_UID}:${PG_GID}; run: chown ${PG_UID}:${PG_GID} ${OUT_DIR}/*"
fi

echo "Done."
echo "  CA:     ${OUT_DIR}/ca.crt"
echo "  Server: ${OUT_DIR}/server.crt + server.key"
echo "Mount this directory as ../certs/postgres from compose (see DEPLOYMENT.md)."
echo "Operator TablePlus VERIFY_CA: copy only ca.crt to your laptop."
