#!/bin/sh
set -e

PORT="${PORT:-80}"

# Render (and most PaaS) inject PORT — point Apache at it
if [ -f /etc/apache2/ports.conf ]; then
  sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
fi
if [ -f /etc/apache2/sites-available/000-default.conf ]; then
  sed -i "s/\*:80/*:${PORT}/g" /etc/apache2/sites-available/000-default.conf
fi

# Writable dirs (Render ephemeral FS; volume mounts for local)
mkdir -p \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
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

# Ensure .env exists so artisan key:generate can persist APP_KEY on the volume
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

# Generate APP_KEY when missing (local first boot)
if [ -z "${APP_KEY:-}" ] || ! grep -qE '^APP_KEY=base64:' .env 2>/dev/null; then
  if [ -z "${APP_KEY:-}" ]; then
    echo "==> Generating APP_KEY..."
    php artisan key:generate --force
  fi
fi

# Cache only outside local (local needs live .env / compose env changes)
if [ "${APP_ENV:-production}" != "local" ] && [ -n "${APP_KEY:-}" ]; then
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
