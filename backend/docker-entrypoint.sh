#!/bin/sh
set -e

# Writable dirs (Render ephemeral FS; volume mounts for local)
mkdir -p \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache 2>/dev/null || true

# Local bind-mounts hide image vendor/ — install into the mount if missing
if [ ! -f vendor/autoload.php ]; then
  echo "==> Installing Composer dependencies (PHP $(php -r 'echo PHP_VERSION;'))..."
  if [ "${APP_ENV:-production}" = "local" ]; then
    composer install --no-interaction --prefer-dist
  else
    composer install --no-dev --no-interaction --prefer-dist
  fi
fi

# Ensure .env exists for local; on Render prefer env vars from the dashboard
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

# Generate APP_KEY only when missing (set APP_KEY on Render so it stays stable)
if [ -z "${APP_KEY:-}" ]; then
  if [ -f .env ] && grep -qE '^APP_KEY=$' .env 2>/dev/null; then
    echo "==> Generating APP_KEY..."
    php artisan key:generate --force
  elif [ -f .env ] && ! grep -qE '^APP_KEY=base64:' .env 2>/dev/null; then
    echo "==> Generating APP_KEY..."
    php artisan key:generate --force
  elif [ ! -f .env ]; then
    echo "==> Generating APP_KEY..."
    php artisan key:generate --force
  fi
fi

# Cache only outside local (local needs live .env / compose env changes)
if [ "${APP_ENV:-production}" != "local" ] && { [ -n "${APP_KEY:-}" ] || grep -qE '^APP_KEY=base64:' .env 2>/dev/null; }; then
  php artisan config:cache || true
  php artisan route:cache || true
  php artisan view:cache || true
fi

# Optional migrate on boot (local compose + optional on Render)
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "==> Running migrations..."
  php artisan migrate --force
fi

exec "$@"
