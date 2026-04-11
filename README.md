## Hi there 👋

I did a GitHub course and therefore I now have a profile repository.

## GitHub Pages hub

This repository also publishes a GitHub Pages landing page from `/site`.

### What it does

- shows a Linktree-style page for the `mudman1986` account
- auto-detects public repositories in the account that have GitHub Pages enabled
- merges those auto-detected links with pinned links from `/site/manual-links.json`
- deploys automatically with GitHub Actions whenever `main` changes

### One-time setup

1. In this repository, open **Settings → Pages**.
2. Set **Build and deployment** to **GitHub Actions** if it is not already selected.
3. After that, every push to `main` will publish the latest `/site` content automatically.

### Updating pinned links

Edit `/home/runner/work/mudman1986/mudman1986/site/manual-links.json` to add, remove, or rename static links.
