#!/bin/bash
# Builds and pushes the Setjoo CRM image (Twenty server + front in one), tagged twenty-<commit>.
# Called by buildspec.yml; needs ECR_REPO and a docker login to ECR.
set -euo pipefail
TAG="${TAG:-$CODEBUILD_RESOLVED_SOURCE_VERSION}"
DOCKERFILE=packages/twenty-docker/twenty/Dockerfile
APP_VERSION=$(sed -nE "s/.*TWENTY_CURRENT_VERSION = '([^']+)'.*/\1/p" \
  packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts)
[ -n "$APP_VERSION" ] || { echo "FATAL: could not read TWENTY_CURRENT_VERSION"; exit 1; }

# Docker Hub rate-limits CodeBuild's shared IPs (429 on 2026-10-29). Point official images
# (no "/" in the name) at AWS's mirror of them; pinned digests stay, so the content is identical.
sed -E 's#^FROM ([a-z0-9._-]+[:@])#FROM public.ecr.aws/docker/library/\1#' "$DOCKERFILE" > /tmp/Dockerfile.crm
grep '^FROM' /tmp/Dockerfile.crm

DOCKER_BUILDKIT=1 docker build -f /tmp/Dockerfile.crm --target twenty \
  --build-arg APP_VERSION="$APP_VERSION" -t "$ECR_REPO:twenty-$TAG" .
docker run --rm --entrypoint sh "$ECR_REPO:twenty-$TAG" -c 'test -f dist/front/index.html' \
  || { echo "FATAL: image has no front build"; exit 1; }
docker push "$ECR_REPO:twenty-$TAG"
