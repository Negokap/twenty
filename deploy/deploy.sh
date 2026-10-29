#!/bin/bash
# On-server deploy for Setjoo CRM. Run as root (CodeBuild calls it with sudo) from
# /opt/setjoo-crm, after build.sh pushed the image for CRM_TAG to ECR.
#
#   Redeploy:  sudo CRM_IMAGE=<ecr repo> CRM_TAG=<git sha> bash deploy.sh
#   Rollback:  same, with an older sha (the last good one is in .deployed-tag)
#
# Every check that can fail runs before the live containers are touched.
# Migrations only go forward: a rollback restores the old image, not the old schema.
set -euo pipefail
cd "$(dirname "$0")"
: "${CRM_IMAGE:?}" "${CRM_TAG:?}"
export CRM_IMAGE CRM_TAG DOCKER_CONFIG="$PWD/.docker"
HOST=crm.setjoo.com
PUBLIC_IP=45.90.108.153
KEEP_TAGS=3

# One deploy at a time on this box (shared with Plane).
exec 9>/var/lock/setjoo-deploy.lock
flock -w 1200 9 || { echo "FATAL: another deploy has held the lock for 20 minutes"; exit 1; }

echo "=== [Setjoo CRM deploy] $(date) tag $CRM_TAG ==="

echo ">>> [1/5] Secrets from Infisical"
bash ./sync-env.sh crm

echo ">>> [2/5] Pre-flight"
for key in APP_SECRET ENCRYPTION_KEY PG_DATABASE_PASSWORD; do
  grep -qE "^$key=['\"]?[^'\"]" .env || { echo "FATAL: $key missing or empty in Infisical CRM/prod"; exit 1; }
done
docker compose config -q
docker compose pull --quiet

echo ">>> [3/5] Migrations"
docker compose run --rm migrate

PREV_TAG=$(cat .deployed-tag 2>/dev/null || true)
# Through nginx with the name pinned to this box, so it works before and after DNS/TLS exist.
healthy() {
  for _ in $(seq 1 45); do
    curl -fsSL -o /dev/null --max-time 5 \
      --resolve "$HOST:80:$PUBLIC_IP" --resolve "$HOST:443:$PUBLIC_IP" "http://$HOST/healthz" && return 0
    sleep 4
  done
  return 1
}

echo ">>> [4/5] Starting $CRM_TAG"
if docker compose up -d --no-build --remove-orphans && healthy; then
  echo "$CRM_TAG" > .deployed-tag
else
  docker compose logs --tail 60 server worker || true
  if [ -n "$PREV_TAG" ]; then
    echo "!!! Unhealthy, rolling back to $PREV_TAG"
    CRM_TAG="$PREV_TAG" docker compose up -d --no-build
    healthy && echo "!!! Rolled back, site is up on $PREV_TAG" || echo "!!! ROLLBACK ALSO UNHEALTHY, check by hand"
  fi
  exit 1
fi

echo ">>> [5/5] Removing images older than the newest $KEEP_TAGS deploys"
docker images "$CRM_IMAGE" --format '{{.Repository}}:{{.Tag}}' | tail -n +$((KEEP_TAGS + 1)) \
  | xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null
echo "=== Done: https://$HOST is on $CRM_TAG ==="
