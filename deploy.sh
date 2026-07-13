#!/usr/bin/env bash
# deploy.sh — pull latest code and restart the vendor portal service
#
# Run as root (or a user with sudo rights to systemctl):
#   bash /opt/vendor-portal/deploy.sh
#
# The script expects the repo to be cloned directly into /opt/vendor-portal/
# (i.e. /opt/vendor-portal/app.py exists).  See README for one-time setup.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE="vendor-portal"

echo "==> Pulling latest code into $DEPLOY_DIR"
git -C "$DEPLOY_DIR" pull --ff-only

echo "==> Installing/upgrading Python dependencies"
"$DEPLOY_DIR/venv/bin/pip" install -q --upgrade -r "$DEPLOY_DIR/requirements.txt"

echo "==> Restarting $SERVICE"
systemctl restart "$SERVICE"
systemctl is-active --quiet "$SERVICE" && echo "==> $SERVICE is running" \
    || { echo "ERROR: $SERVICE failed to start — check: journalctl -u $SERVICE -n 50"; exit 1; }
