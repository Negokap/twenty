#!/bin/bash
# Pulls the app's 'prod' secrets from Infisical into ./.env (same script as on mpp-server).
# Usage: sync-env.sh <project>. Reads the machine identity from /root/.infisical/<project>.env
# (INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID), which only Arya/Pierre write.
set -euo pipefail
PROJECT="$1"
CREDS="/root/.infisical/${PROJECT}.env"
DOMAIN="https://secrets.pierrepjoseph.com/api"

[ -f "$CREDS" ] || { echo "FATAL: no Infisical credentials at $CREDS" >&2; exit 1; }
source "$CREDS"

TOKEN=$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" \
  --domain="$DOMAIN" --plain --silent)

# Write to a temp file first so a failed export never leaves a half-written .env behind.
umask 077
infisical export --token="$TOKEN" --domain="$DOMAIN" \
  --projectId="$INFISICAL_PROJECT_ID" --env=prod --format=dotenv -o .env.new --silent
[ -s .env.new ] || { echo "FATAL: Infisical export was empty" >&2; rm -f .env.new; exit 1; }
mv .env.new .env
echo "    synced $(grep -c = .env) vars from Infisical ($PROJECT/prod)"
