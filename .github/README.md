# GitHub Pages hub

This repository publishes a GitHub Pages landing page from `/site`.

### What it does

- shows a Linktree-style page for the `mudman1986` account
- auto-detects public repositories in the account that have GitHub Pages enabled
- merges those auto-detected links with pinned links from `/site/manual-links.json`
- deploys automatically with GitHub Actions whenever `main` changes

### Updating pinned links

Edit `site/manual-links.json` to add, remove, or rename static links.
