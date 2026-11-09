#!/usr/bin/env bash
# Build the app and publish dist/ to the gh-pages branch of origin (GitHub Pages).
# Keeps gh-pages history (no force push): clones the branch if it exists, replaces its contents, commits, pushes.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
REMOTE_URL="$(git remote get-url origin)"
TMP="$(mktemp -d)"
if git ls-remote --exit-code --heads "$REMOTE_URL" gh-pages >/dev/null 2>&1; then
  git clone -q --branch gh-pages --single-branch --depth 1 "$REMOTE_URL" "$TMP"
  find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  git init -q -b gh-pages "$TMP"
  git -C "$TMP" remote add origin "$REMOTE_URL"
fi
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll"
git -C "$TMP" add -A
git -C "$TMP" -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "Deploy BRAIBO to GitHub Pages ($(git rev-parse --short HEAD))" || echo "nothing to deploy"
git -C "$TMP" push origin gh-pages
rm -rf "$TMP"
echo "deployed to gh-pages"
