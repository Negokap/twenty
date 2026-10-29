# Setjoo CRM: build and deploy pipeline

```
merge to setjoo ──▶ AWS CodeBuild "crm-build" ──▶ ECR "crm" ──▶ sj-app-prod-01 (hst-2) ──▶ https://crm.setjoo.com
                    deploy/build.sh: one image      tag             deploy/deploy.sh: secrets from Infisical,
                    (server + front)                twenty-<sha>    migrate, start, health check, auto-rollback
```

Production only. No staging.

## For developers

1. Branch off `setjoo`, build your feature, and open a PR into `setjoo`.
2. After review, merge. About 30–40 minutes later the change is live. The CodeBuild log shows each step.

You never need AWS access, server access or secret values. If your feature needs a new
environment variable, put its **name** in the PR description. Arya adds the value to
Infisical (`CRM` project, `prod`) before the merge. Twenty reads its front-end config from the
server at runtime, so nothing is baked into the image.

## What runs on hst-2

`/opt/setjoo-crm` holds `docker-compose.yml`, `deploy.sh`, `sync-env.sh` (copied by every build) and the
root-only `.env`. Compose project `setjoo-crm`:

- `server` (Twenty API + front) on `127.0.0.1:3010`, behind nginx site `crm.setjoo.com`.
- `worker` (same image, `yarn worker:prod`).
- `redis` (local, persistent).
- `migrate` (one-off, profile `tools`): the image's entrypoint runs `upgrade` and registers cron jobs.
  Upstream's entrypoint only warns when a workspace upgrade fails, so read its log after version bumps.

Postgres is `twenty_app` on sj-db-prod-01 (`10.10.0.3:5432`, over WireGuard). Files go to the
`local-storage` volume. Plane runs on the same box; the two share only nginx and the deploy lock.

## Running it by hand (people with server access)

- Status: `ssh hst-2 'cat /opt/setjoo-crm/.deployed-tag; sudo docker compose -p setjoo-crm ps'`
- Redeploy or roll back to a commit already in ECR:
  `ssh hst-2 'cd /opt/setjoo-crm && sudo CRM_IMAGE=535391556744.dkr.ecr.us-east-1.amazonaws.com/crm CRM_TAG=<sha> bash deploy.sh'`
  (The ECR login on the box lasts 12 hours. Re-run the CodeBuild project if it has expired.)
- Rebuild without a code change: start a build of `crm-build` in the AWS console.

## Secrets

All runtime config sits in one Infisical project, **`CRM`, env `prod`**, at secrets.pierrepjoseph.com.
On every deploy it is exported into `/opt/setjoo-crm/.env` (mode 600) by the read-only identity `crm-deploy`,
whose credentials are in `/root/.infisical/crm.env`. `deploy.sh` stops before touching anything if
`APP_SECRET`, `ENCRYPTION_KEY` or `PG_DATABASE_PASSWORD` is missing or empty. The DB password must be
URL-safe, because compose splices it into `PG_DATABASE_URL`. Fixed, non-secret settings (`SERVER_URL`,
DB host, Redis) live in `docker-compose.yml`.

## AWS and server pieces (already created)

- ECR `crm` (lifecycle: keep the last 15 images), IAM role `crm-codebuild-role` (push/pull on `crm`,
  `ssm:GetParameter` on `/crm/*`, logs), SSM SecureString `/crm/deploy-ssh-key` (its public half is in
  deploy@hst-2's `authorized_keys`).
- CodeBuild `crm-build`: GitHub `Negokap/twenty`, `aws/codebuild/standard:7.0`, privileged,
  `BUILD_GENERAL1_LARGE`, webhook PUSH on `^refs/heads/setjoo$`.
- hst-2: `/opt/setjoo-crm` (owner deploy), nginx site `/etc/nginx/sites-available/crm.setjoo.com`
  (HTTP only until the DNS record exists; then `sudo certbot --nginx -d crm.setjoo.com`).
