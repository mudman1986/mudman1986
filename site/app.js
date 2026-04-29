const githubUser = document.querySelector('meta[name="github-user"]')?.content?.trim();
const githubRepo = document.querySelector('meta[name="github-repo"]')?.content?.trim();
const linksContainer = document.getElementById('links-container');
const statusText = document.getElementById('status-text');
const apiBaseUrl = 'https://api.github.com';
const manualLinksPath = './manual-links.json';
const githubRequestTimeoutMs = 10000;

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

async function fetchWithTimeout(url, options = {}, timeoutMs = githubRequestTimeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`, { cause: error });
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchPageRepositories() {
  if (!githubUser) {
    return [];
  }

  const repositories = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchWithTimeout(`${apiBaseUrl}/users/${githubUser}/repos?per_page=100&page=${page}&sort=updated`, {
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
      anchor.title = `${link.title} — ${link.description}`;

      const safeUrl = link.url.replace(/^https?:\/\//, '');
      const header = document.createElement('div');
      header.className = 'link-card-header';

      const title = document.createElement('h3');
      title.textContent = link.title;

      const source = document.createElement('span');
      source.className = 'meta-pill';
      source.textContent = link.source === 'Auto-detected' ? 'Auto' : link.source;
      source.setAttribute('aria-label', link.source);
      source.title = link.source;

      header.append(title, source);

      const description = document.createElement('p');
      description.textContent = link.description;

      const footer = document.createElement('div');
      footer.className = 'link-card-footer';

      const url = document.createElement('span');
      url.className = 'link-url';
      url.textContent = safeUrl;

      footer.append(url);
      anchor.append(header, description, footer);

      return anchor;
    }),
  );
}

async function loadLinks() {
  setStatus('Loading known links…');

  const discoveredLinksPromise = fetchPageRepositories()
    .then((value) => ({ status: 'fulfilled', value }))
    .catch((reason) => ({ status: 'rejected', reason }));
  let manualLinks = [];

  try {
    manualLinks = await fetchManualLinks();

    if (manualLinks.length) {
      renderLinks(mergeLinks(manualLinks, []));
      setStatus(`Showing ${manualLinks.length} pinned link${manualLinks.length === 1 ? '' : 's'} while checking GitHub Pages…`);
    } else {
      setStatus('Checking GitHub Pages…');
    }
  } catch (error) {
    console.error(error);
    setStatus('Checking GitHub Pages…');
  }

  try {
    const discoveredResult = await discoveredLinksPromise;

    if (discoveredResult.status === 'rejected') {
      throw discoveredResult.reason;
    }

    const discoveredLinks = discoveredResult.value;
    const combinedLinks = mergeLinks(manualLinks, discoveredLinks);

    renderLinks(combinedLinks);

    if (combinedLinks.length) {
      setStatus(`Showing ${combinedLinks.length} link${combinedLinks.length === 1 ? '' : 's'}`);
    } else {
      setStatus('No links found yet');
    }
  } catch (error) {
    console.error(error);

    if (manualLinks.length) {
      setStatus(`Showing ${manualLinks.length} pinned link${manualLinks.length === 1 ? '' : 's'} while GitHub auto-discovery is unavailable`);
      return;
    }

    setStatus('Unable to load GitHub Pages right now');
  }
}

loadLinks();
