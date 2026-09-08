#!/usr/bin/env bash
# 只传递发布身份和临时拉取凭据；实际部署配置由服务器维护。
set -euo pipefail
: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}"
: "${APP_IMAGE:?}" "${APP_VERSION:?}" "${GH_TOKEN:?}" "${GITHUB_ACTOR:?}"
[[ "$APP_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ "$APP_IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
chmod 700 "$work"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$work/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$work/known_hosts"
chmod 600 "$work/key" "$work/known_hosts"
# stdin 只送入服务器受限入口，不把临时令牌放进命令行或输出。
python3 - <<'PY' | ssh -T -i "$work/key" -p "${DEPLOY_PORT:-22}" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$work/known_hosts" -o ConnectTimeout=15 \
  "$DEPLOY_USER@$DEPLOY_HOST" "deploy $APP_VERSION $APP_IMAGE"
import json, os
print(json.dumps({"username": os.environ["GITHUB_ACTOR"], "token": os.environ["GH_TOKEN"]}))
PY
