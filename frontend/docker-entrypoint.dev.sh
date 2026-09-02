#!/bin/sh
set -e

# Bind-mount hides image node_modules — install into the named volume if empty
# Ensure Corepack uses the same pnpm as the image (volume mounts can reset PATH quirks)
corepack prepare pnpm@9.15.9 --activate >/dev/null 2>&1 || true

if [ ! -x node_modules/.bin/next ]; then
  echo "==> Installing frontend dependencies (Node $(node -v), pnpm $(pnpm -v))..."
  pnpm install --frozen-lockfile
fi

exec "$@"
