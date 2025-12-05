#!/usr/bin/env bash
# Usage: put this file inside your project folder (where index.html, README.md, .gitignore live),
# make it executable (chmod +x deploy.sh) and run ./deploy.sh
set -e

REPO_OWNER="tjperko"
REPO_NAME="sushi-rolls"
VISIBILITY="public"   # change to "private" if desired
BRANCH="main"

echo "Starting deploy helper for ${REPO_OWNER}/${REPO_NAME}..."

# Initialize git if needed
if [ ! -d .git ]; then
  git init
  git branch -M "${BRANCH}"
fi

git add .
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "Initial commit: static site" || true
fi

# Try using GitHub CLI if available
if command -v gh >/dev/null 2>&1; then
  echo "Detected gh CLI. Ensure you are authenticated (gh auth login) if not already."
  # create repo and push (won't overwrite if already exists)
  set +e
  gh repo create "${REPO_OWNER}/${REPO_NAME}" --"${VISIBILITY}" --source=. --remote=origin --push
  GH_EXIT=$?
  set -e
  if [ $GH_EXIT -ne 0 ]; then
    echo "gh repo create returned non-zero exit. If the repo already exists, ensure remote is set and push:"
    echo "  git remote add origin git@github.com:${REPO_OWNER}/${REPO_NAME}.git  # or HTTPS"
    echo "  git push -u origin ${BRANCH}"
  fi
else
  echo "gh CLI not found. Please create the repo on GitHub (website) or install gh CLI:"
  echo "  https://cli.github.com/"
  echo
  echo "Manual push commands to run once repo exists:"
  echo "  git remote add origin git@github.com:${REPO_OWNER}/${REPO_NAME}.git"
  echo "  git push -u origin ${BRANCH}"
fi

echo
echo "Done. Next step: enable GitHub Pages to serve the site (choose branch: ${BRANCH}, folder: / (root))."
echo " - Go to: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/pages"
echo " - Under 'Build and deployment' choose 'Branch: ${BRANCH}', folder '/' (root), Save."
echo
echo "Expected Pages URL (after publishing): https://${REPO_OWNER}.github.io/${REPO_NAME}/"
echo
echo "If you'd like, after you run this you can paste the repo URL here and I'll verify the settings and provide a checklist for DNS/custom domain, or optionally add a GitHub Actions workflow later."