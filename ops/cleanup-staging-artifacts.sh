#!/usr/bin/env bash
# Run as the staging service account, before uploading a new verified release.
# Only remove disposable deployment uploads and a specifically known failed release.
set -euo pipefail
umask 077
sha=${1:?expected verified commit SHA}
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
incoming=/var/lib/hodhod/incoming
releases=/opt/hodhod/releases
active=$(readlink -f /srv/hodhod || true)
[[ "$active" == "$releases/"* ]] || { echo "Unknown active release; refusing cleanup" >&2; exit 1; }
echo "Disk usage before safe cleanup:"
df -h /
du -sh "$incoming" "$releases" "$HOME/.npm/_cacache" 2>/dev/null || true
# Uploaded tarballs are disposable once their deploy job has finished.
# Preserve the current upload, active release and anything not verified as our artifact.
shopt -s nullglob
for candidate in "$incoming"/*; do
  [[ -d "$candidate" && ! -L "$candidate" ]] || continue
  oldsha=${candidate##*/}
  [[ "$oldsha" =~ ^[a-f0-9]{40}$ ]] || continue
  [[ "$oldsha" != "$sha" ]] || continue
  [[ "$candidate" != "$active" ]] || continue
  [[ -f "$candidate/COMMIT" ]] || continue
  [[ "$(cat "$candidate/COMMIT")" == "$oldsha" ]] || continue
  echo "Removing completed deploy upload $oldsha"
  rm -rf -- "$candidate"
done
# npm's download cache is reproducible and never stores site/application data.
if [[ "$HOME" == /var/lib/hodhod && -d "$HOME/.npm/_cacache" && ! -L "$HOME/.npm/_cacache" ]]; then
  echo "Removing disposable npm download cache"
  rm -rf -- "$HOME/.npm/_cacache"
fi
# This exact SHA failed before activation with ENOSPC. Never delete a running release.
failed="$releases/853389f6b11357ffc211999c7f4acc7ee2dd4804"
if [[ "$failed" != "$active" && "$failed" != "$releases/$sha" && -d "$failed" && ! -L "$failed" ]]; then
  if [[ -w "$releases" ]]; then
    echo "Removing known failed inactive release"
    rm -rf -- "$failed"
  elif sudo -n /usr/bin/rm -rf -- "$failed" 2>/dev/null; then
    echo "Removed known failed inactive release with authorized sudo"
  else
    echo "WARNING: failed inactive release requires administrator cleanup: $failed" >&2
  fi
fi
echo "Disk usage after safe cleanup:"
df -h /
