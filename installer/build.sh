#!/usr/bin/env bash
# ============================================================
# GENERA EL INSTALADOR WINDOWS: installer/dist/ValetecPOS-Setup-<version>.exe
# Requisitos (Linux): node, npm, curl, unzip, docker (para NSIS)
# Uso: ./installer/build.sh
# ============================================================
set -euo pipefail

NODE_VERSION="20.20.2"
PG_VERSION="16.10-1"
WINSW_VERSION="2.12.0"
OBFUSCATOR_VERSION="4.1.1"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
INST="$REPO/installer"
CACHE="$INST/cache"
STAGE="$INST/build/stage"
OUT="$INST/dist"
VERSION="$(node -p "require('$REPO/package.json').version")"

mkdir -p "$CACHE" "$OUT"

download() { # url destino
  if [ ! -s "$2" ]; then
    echo "⬇️  Descargando $(basename "$2")..."
    curl -fL --retry 3 -o "$2.part" "$1" && mv "$2.part" "$2"
  fi
}

download "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-win-x64.zip" "$CACHE/node-win.zip"
download "https://get.enterprisedb.com/postgresql/postgresql-$PG_VERSION-windows-x64-binaries.zip" "$CACHE/pgsql-win.zip"
download "https://github.com/winsw/winsw/releases/download/v$WINSW_VERSION/WinSW.NET4.exe" "$CACHE/winsw.exe"
download "https://aka.ms/vs/17/release/vc_redist.x64.exe" "$CACHE/vc_redist.x64.exe"

echo "🧹 Preparando carpeta de empaquetado..."
rm -rf "$INST/build"
mkdir -p "$STAGE"/{node,app/backend,setup}

# 1. Node portable (solo el ejecutable)
unzip -q -j "$CACHE/node-win.zip" "node-v$NODE_VERSION-win-x64/node.exe" -d "$STAGE/node"

# 2. PostgreSQL portable (sin pgAdmin, documentación ni cabeceras de desarrollo)
unzip -q "$CACHE/pgsql-win.zip" 'pgsql/bin/*' 'pgsql/lib/*' 'pgsql/share/*' -d "$STAGE"
find "$STAGE/pgsql/lib" -type f \( -name '*.lib' -o -name '*.a' \) -delete
rm -rf "$STAGE/pgsql/share/doc"

# 3. Frontend compilado
echo "🏗️  Compilando frontend..."
(cd "$REPO" && npm ci --silent && npx vite build --logLevel warn)
cp -r "$REPO/dist" "$STAGE/app/dist"

# 4. Backend con motores de Prisma para Windows
echo "📦 Empaquetando backend..."
cp -r "$REPO/backend/server.js" "$REPO/backend/config" "$REPO/backend/prisma" \
      "$REPO/backend/package.json" "$REPO/backend/package-lock.json" "$STAGE/app/backend/"
rm -f "$STAGE/app/backend/prisma/seed.js" # seed de demostración: borra ventas, no va en instalaciones
(cd "$STAGE/app/backend" \
  && PRISMA_CLI_BINARY_TARGETS=windows npm ci --silent --no-audit --no-fund \
  && npx prisma generate >/dev/null)
# El CLI no descarga el schema-engine de Windows con PRISMA_CLI_BINARY_TARGETS: se obtiene directo
ENGINE_HASH="$(cd "$STAGE/app/backend" && node -p "require('@prisma/engines-version').enginesVersion")"
download "https://binaries.prisma.sh/all_commits/$ENGINE_HASH/windows/schema-engine.exe.gz" "$CACHE/schema-engine-$ENGINE_HASH.exe.gz"
gunzip -c "$CACHE/schema-engine-$ENGINE_HASH.exe.gz" > "$STAGE/app/backend/node_modules/@prisma/engines/schema-engine-windows.exe"
# Quitar motores de Linux (no se usan en Windows)
find "$STAGE/app/backend/node_modules" -type f \( -name '*linux*' -o -name '*debian*' -o -name '*darwin*' \) \
  \( -path '*@prisma/engines*' -o -path '*.prisma/client*' -o -path '*prisma/*' \) -delete
for f in node_modules/@prisma/engines/schema-engine-windows.exe node_modules/.prisma/client/query_engine-windows.dll.node; do
  [ -f "$STAGE/app/backend/$f" ] || { echo "❌ Falta $f"; exit 1; }
done

# 5. Scripts de configuración, servicio y runtime de Visual C++ (requerido por PostgreSQL)
cp "$INST/setup/setup.js" "$INST/setup/uninstall.js" "$STAGE/setup/"
cp "$CACHE/winsw.exe" "$STAGE/setup/ValetecPOS-App.exe"
cp "$CACHE/vc_redist.x64.exe" "$STAGE/setup/"

# 6. Ofuscación del código propio (solo en la copia empaquetada, el repo no se toca)
echo "🔒 Ofuscando código..."
OBF="npx --yes javascript-obfuscator@$OBFUSCATOR_VERSION"
OBF_OPTS="--compact true --string-array true --string-array-encoding base64 --string-array-threshold 0.75 \
  --identifier-names-generator hexadecimal --rename-globals false --self-defending false --control-flow-flattening false"
for f in server.js config/company.js prisma/seed-clean.js; do
  $OBF "$STAGE/app/backend/$f" --output "$STAGE/app/backend/$f" $OBF_OPTS >/dev/null
done
rm -f "$STAGE"/app/dist/assets/*.map
for f in "$STAGE"/app/dist/assets/*.js; do
  $OBF "$f" --output "$f" --compact true --string-array true --string-array-threshold 0.5 \
    --identifier-names-generator hexadecimal --rename-globals false --self-defending false >/dev/null
done

# 7. Icono + compilación NSIS dentro de Docker
echo "🔨 Generando instalador..."
docker run --rm -v "$REPO:/w" -w /w debian:stable-slim sh -c "
  apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nsis imagemagick >/dev/null 2>&1 &&
  convert public/logo.png -resize 256x256 -background none -gravity center -extent 256x256 \
    -define icon:auto-resize=256,64,48,32,16 installer/build/stage/setup/icon.ico &&
  makensis -V2 -DSTAGE=/w/installer/build/stage -DVERSION=$VERSION \
    -DOUTFILE=/w/installer/dist/ValetecPOS-Setup-$VERSION.exe installer/valetec.nsi &&
  chown $(id -u):$(id -g) installer/build/stage/setup/icon.ico installer/dist/*.exe"

ls -lh "$OUT/ValetecPOS-Setup-$VERSION.exe"
echo "✅ Instalador listo."
