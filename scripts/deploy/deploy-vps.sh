#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/whatsapp-webhook}"
COMPOSE_FILE="docker-compose.prod.yml"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "Arquivo $APP_DIR/.env não encontrado. Crie-o na VPS com META_ACCESS_TOKEN, META_VERIFY_TOKEN e SESSION_HASH_SECRET."
  exit 1
fi

chmod 600 .env
mkdir -p data

echo "Atualizando whatsapp-webhook em $APP_DIR"
APP_UID="$(id -u)" APP_GID="$(id -g)" \
  docker compose --env-file config/public-config.env --env-file .env -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "Aguardando o webhook iniciar..."
status=""
for attempt in $(seq 1 30); do
  status="$(curl --max-time 3 --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:18084/webhook || true)"
  if [ "$status" = "403" ]; then
    break
  fi
  sleep 2
done

if [ "$status" != "403" ]; then
  echo "O webhook não respondeu como esperado (HTTP ${status:-sem resposta})."
  docker compose --env-file config/public-config.env --env-file .env -f "$COMPOSE_FILE" ps
  exit 1
fi

docker image prune -f --filter "until=168h"

echo "Deploy finalizado. Estado persistido em $APP_DIR/data."
