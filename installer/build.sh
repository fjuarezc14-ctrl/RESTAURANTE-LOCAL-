#!/usr/bin/env bash
# La lógica del build está en build.mjs
exec node "$(dirname "$0")/build.mjs" "$@"
