#!/usr/bin/env bash
# ================================================================
# MUDAR LA BASE DEL LOCAL (Windows) A LA VERSIÓN WEB
# Carga un respaldo .dump ("Sacar respaldo" del local) en la base de docker-compose.prod.yml.
# Uso: ./scripts/importar-respaldo.sh .env.<cliente> respaldo.dump [--reemplazar]
#   --reemplazar: la base web ya tiene ventas y se quiere pisar (antes se respalda en respaldos/).
# Al terminar levanta todo: el backend aplica las migraciones pendientes al arrancar.
# Guía completa: docs/SOPORTE.md §6
# ================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${1:-}"; DUMP="${2:-}"; MODO="${3:-}"
falla() { echo "❌ $*" >&2; exit 1; }
[[ -f "$ENV_FILE" && -f "$DUMP" ]] || falla "Uso: $0 .env.<cliente> respaldo.dump [--reemplazar]"

valor() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true; }
PIN_SECRET="$(valor PIN_SECRET)"
[[ -n "$PIN_SECRET" && "$PIN_SECRET" != \<* ]] \
  || falla "Falta PIN_SECRET en $ENV_FILE: copia el de C:\\ValetecPOS\\app\\backend\\.env del local (sin él, ningún PIN funciona)."
DB_USER="$(valor DB_USER)"; DB_USER="${DB_USER:-local_user}"

ARCHIVOS=(-f docker-compose.prod.yml)
[[ -n "$(valor DOMINIO)" ]] && ARCHIVOS+=(-f docker-compose.https.yml)
dc() { docker compose "${ARCHIVOS[@]}" --env-file "$ENV_FILE" "$@"; }
sql() { dc exec -T db psql -U "$DB_USER" -d restaurante_local -v ON_ERROR_STOP=1 -tAc "$1"; }

echo "▶ Levantando la base..."
dc up -d --wait db

VENTAS=0
[[ "$(sql "SELECT to_regclass('\"Venta\"') IS NOT NULL")" == "t" ]] && VENTAS="$(sql 'SELECT count(*) FROM "Venta"')"
if [[ "$VENTAS" -gt 0 ]]; then
  [[ "$MODO" == "--reemplazar" ]] || falla "La base web ya tiene $VENTAS ventas. Para pisarla, repite con --reemplazar."
  mkdir -p respaldos
  ANTES="respaldos/web-antes-de-importar-$(date +%F_%H-%M).dump"
  dc exec -T db pg_dump -U "$DB_USER" -d restaurante_local -Fc --no-owner > "$ANTES"
  echo "  Respaldo de la base web actual: $ANTES"
fi

echo "▶ Deteniendo el backend y cargando $DUMP..."
dc stop backend >/dev/null 2>&1 || true
sql "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
dc cp "$DUMP" db:/tmp/importar.dump
dc exec -T db pg_restore -U "$DB_USER" -d restaurante_local --no-owner --no-privileges --exit-on-error /tmp/importar.dump
dc exec -T db rm -f /tmp/importar.dump

echo "  Importado: $(sql 'SELECT count(*) FROM "Venta"') ventas, $(sql 'SELECT count(*) FROM "Usuario"') usuarios, $(sql 'SELECT count(*) FROM "Producto"') productos."

echo "▶ Levantando todo (el backend aplica las migraciones pendientes)..."
dc up -d --build
for _ in $(seq 1 60); do
  dc logs backend 2>&1 | grep -q "corriendo en" && break
  sleep 2
done
dc logs --tail 15 backend
echo "✅ Listo. Cada equipo debe activarse de nuevo en la dirección web (usuario admin y su contraseña)."
