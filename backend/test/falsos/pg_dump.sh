#!/bin/sh
# pg_dump simulado para las pruebas de respaldo: imprime un .dump falso, o falla si PG_DUMP_FALLAR=1
if [ "$PG_DUMP_FALLAR" = "1" ]; then
  echo "pg_dump: error: conexión rechazada" >&2
  exit 1
fi
printf 'PGDMP-respaldo-falso %s' "$*"
