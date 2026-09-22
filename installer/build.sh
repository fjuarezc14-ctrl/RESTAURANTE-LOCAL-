#!/usr/bin/env bash
# Atajo para Linux: la lógica del build está en build.mjs (compartida con Windows)
exec node "$(dirname "$0")/build.mjs" "$@"
