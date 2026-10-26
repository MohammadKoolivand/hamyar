#!/usr/bin/env bash
# Install root-owned as /usr/local/sbin/hodhod-deploy after reviewing this file.
set -euo pipefail
umask 077
sha=${1:-}
activate=${2:-false}
[[ "$sha" =~ ^[a-f0-9]{40}$ && "$activate" =~ ^(true|false)$ ]] || exit 2
[[ $EUID == 0 ]] || exit 2
exec 9>/run/lock/hodhod-deploy.lock
flock -n 9 || { echo 'Another deployment is active'; exit 1; }
incoming=/var/lib/hodhod/incoming/$sha
release=/opt/hodhod/releases/$sha
[[ $(cat "$incoming/COMMIT") == "$sha" ]]
(cd "$incoming" && sha256sum -c SHA256SUMS)
# Never overwrite an existing release, and never import local env/private files.
[[ ! -e "$release" ]]
install -d -o hodhod -g hodhod "$release"
tar -xzf "$incoming/source.tar.gz" -C "$release" --no-same-owner
[[ ! -e "$release/.env" && ! -e "$release/.private" ]]
ln -s /etc/hodhod/staging.env "$release/.env"
ln -s /var/lib/hodhod/private "$release/.private"
chown -R hodhod:hodhod "$release"
cd "$release"
runuser -u hodhod -- npm ci
runuser -u hodhod -- npm run ocr:setup
runuser -u hodhod -- npm run typecheck
runuser -u hodhod -- npm run lint
runuser -u hodhod -- npm run build
runuser -u hodhod -- npm run ops:preflight -- web
runuser -u hodhod -- npm run ops:preflight -- exams
if [[ "$activate" == false ]]; then
  echo "Prepared $sha; services unchanged"
  exit 0
fi
# Existing installation only. First installation is an explicit operator bootstrap.
previous=$(readlink -f /srv/hodhod)
[[ -d "$previous" && "$previous" == /opt/hodhod/releases/* && "$previous" != "$release" ]]
# Root-owned hook must back up the configured DB; failure aborts activation.
[[ -x /etc/hodhod/backup-before-release ]]
[[ $(stat -c %u /etc/hodhod/backup-before-release) == 0 ]]
mail_active=false
if systemctl is-active --quiet hodhod-mail-worker; then
  mail_active=true
  runuser -u hodhod -- npm run ops:preflight -- mail
fi
rollback() {
  trap - ERR INT TERM
  systemctl stop hodhod-web hodhod-exam-worker || true
  if [[ "$mail_active" == true ]]; then systemctl stop hodhod-mail-worker || true; fi
  ln -sfn "$previous" /srv/hodhod.rollback
  mv -Tf /srv/hodhod.rollback /srv/hodhod
  systemctl start hodhod-web hodhod-exam-worker
  if [[ "$mail_active" == true ]]; then systemctl start hodhod-mail-worker; fi
  echo 'Deployment failed; previous code restored. Database was not rolled back.' >&2
  exit 1
}
trap rollback ERR INT TERM
systemctl stop hodhod-web hodhod-exam-worker
if [[ "$mail_active" == true ]]; then systemctl stop hodhod-mail-worker; fi
/etc/hodhod/backup-before-release
ln -sfn "$release" /srv/hodhod.next
mv -Tf /srv/hodhod.next /srv/hodhod
systemctl start hodhod-web hodhod-exam-worker
if [[ "$mail_active" == true ]]; then systemctl start hodhod-mail-worker; fi
healthy=false
for _ in {1..30}; do
  if curl -fsS --max-time 5 http://127.0.0.1:5174/api/health > /dev/null && systemctl is-active --quiet hodhod-web hodhod-exam-worker; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" == true ]]
if [[ "$mail_active" == true ]]; then systemctl is-active --quiet hodhod-mail-worker; fi
trap - ERR INT TERM
echo "Activated $sha"
