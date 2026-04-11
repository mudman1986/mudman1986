const githubUser = document.querySelector('meta[name="github-user"]')?.content?.trim();
const githubRepo = document.querySelector('meta[name="github-repo"]')?.content?.trim();
const linksContainer = document.getElementById('links-container');
const statusText = document.getElementById('status-text');
const refreshButton = document.getElementById('refresh-button');
const apiBaseUrl = 'https://api.github.com';
const manualLinksPath = './manual-links.json';

function setStatus(message) {
  statusText.textContent = message;
}

function titleFromRepositoryName(name) {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeUrl(url) {
  try {
    return new URL(url).toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function resolvePageUrl(repository) {
  const homepage = normalizeUrl(repository.homepage || '');

  if (homepage) {
    return homepage;
  }

  if (!githubUser) {
    return '';
  }

  if (repository.name.toLowerCase() === githubUser.toLowerCase()) {
    return `https://${githubUser}.github.io`;
  }

  return `https://${githubUser}.github.io/${repository.name}`;
}

async function fetchManualLinks() {
  const response = await fetch(manualLinksPath, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Manual links request failed with ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.links) ? payload.links : [];
}

async function fetchPageRepositories() {
  if (!githubUser) {
    return [];
  }

  const repositories = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${apiBaseUrl}/users/${githubUser}/repos?per_page=100&page=${page}&sort=updated`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed with ${response.status}`);
    }

    const pageRepositories = await response.json();
    repositories.push(...pageRepositories);

    if (pageRepositories.length < 100) {
      break;
    }
  }

  return repositories
    .filter((repository) => repository.owner?.login?.toLowerCase() === githubUser.toLowerCase())
    .filter((repository) => repository.has_pages)
    .filter((repository) => !repository.fork)
    .filter((repository) => repository.name !== githubRepo)
    .map((repository) => ({
      title: titleFromRepositoryName(repository.name),
      description: repository.description || 'Auto-detected from GitHub Pages',
      url: resolvePageUrl(repository),
      source: 'Auto-detected',
      updatedAt: repository.updated_at || '',
    }))
    .filter((link) => normalizeUrl(link.url));
}

function mergeLinks(manualLinks, discoveredLinks) {
  const byUrl = new Map();

  discoveredLinks
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .forEach((link) => {
      byUrl.set(normalizeUrl(link.url), {
        ...link,
        source: link.source || 'Auto-detected',
      });
    });

  manualLinks.forEach((link) => {
    const normalizedUrl = normalizeUrl(link.url || '');

    if (!normalizedUrl) {
      return;
    }

    byUrl.set(normalizedUrl, {
      title: link.title?.trim() || normalizedUrl,
      description: link.description?.trim() || 'Pinned link',
      url: normalizedUrl,
      source: link.source?.trim() || 'Pinned',
      updatedAt: link.updatedAt || '',
    });
  });

  return Array.from(byUrl.values()).sort((left, right) => {
    const leftPinned = left.source !== 'Auto-detected';
    const rightPinned = right.source !== 'Auto-detected';

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    if (left.updatedAt && right.updatedAt && left.updatedAt !== right.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return left.title.localeCompare(right.title);
  });
}

function renderLinks(links) {
  if (!links.length) {
    linksContainer.innerHTML = '<div class="empty-state">No links found yet. Add entries to manual-links.json or publish a GitHub Pages repo in this account.</div>';
    return;
  }

  linksContainer.replaceChildren(
    ...links.map((link) => {
      const anchor = document.createElement('a');
      anchor.className = 'link-card';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';

      const safeUrl = link.url.replace(/^https?:\/\//, '');

      anchor.innerHTML = `
        <div class="link-card-header">
          <h3>${link.title}</h3>
          <span class="meta-pill">${link.source}</span>
        </div>
        <p>${link.description}</p>
        <div class="link-card-footer">
          <span class="link-url">${safeUrl}</span>
        </div>
      `;

      return anchor;
    }),
  );
}

async function loadLinks() {
  refreshButton.disabled = true;
  setStatus('Loading links…');

  try {
    const [manualLinks, discoveredLinks] = await Promise.all([fetchManualLinks(), fetchPageRepositories()]);
    const combinedLinks = mergeLinks(manualLinks, discoveredLinks);
    renderLinks(combinedLinks);
    setStatus(`Showing ${combinedLinks.length} link${combinedLinks.length === 1 ? '' : 's'}`);
  } catch (error) {
    console.error(error);
    renderLinks([]);
    setStatus('Unable to load GitHub Pages right now');
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', () => {
  loadLinks();
});

loadLinks();
