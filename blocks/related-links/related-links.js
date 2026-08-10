import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const SITE_PREFIXES = ['/content/eba', '/content/edsbyamit'];

/**
 * Normalize authored/index paths for lookup.
 * Strips .html, trailing slash, and AEM site prefixes.
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  if (!path) return '';
  let pathname = path;
  try {
    pathname = new URL(path, window.location.origin).pathname;
  } catch {
    // keep raw path
  }
  pathname = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  SITE_PREFIXES.forEach((prefix) => {
    if (pathname === prefix) pathname = '/';
    else if (pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length) || '/';
  });
  return pathname;
}

/**
 * Candidate paths used when matching index rows to an authored link.
 * @param {string} href
 * @returns {string[]}
 */
function lookupKeys(href) {
  const normalized = normalizePath(href);
  const keys = new Set([normalized]);
  try {
    const raw = new URL(href, window.location.origin).pathname
      .replace(/\.html$/, '')
      .replace(/\/$/, '') || '/';
    keys.add(raw);
  } catch {
    // ignore
  }
  return [...keys];
}

/**
 * Resolve which query index URLs to try.
 * @returns {string[]}
 */
function getIndexUrls() {
  const urls = [];
  if (window.location.pathname.startsWith('/drafts/')) {
    urls.push('/drafts/query-index.json');
  }
  urls.push('/query-index.json');
  return urls;
}

/**
 * Load query index data (supports single-sheet JSON).
 * @param {string} indexUrl
 * @returns {Promise<Array<object>>}
 */
async function loadIndex(indexUrl) {
  const resp = await fetch(indexUrl);
  if (!resp.ok) throw new Error(`Failed to load index: ${indexUrl}`);
  const json = await resp.json();
  if (Array.isArray(json.data)) return json.data;
  if (json[':type'] === 'multi-sheet' && json.default?.data) return json.default.data;
  return [];
}

/**
 * Try each index URL until one succeeds.
 * @returns {Promise<Map<string, object>>}
 */
async function loadIndexMap() {
  const map = new Map();
  const results = await Promise.all(getIndexUrls().map(async (url) => {
    try {
      return await loadIndex(url);
    } catch {
      return [];
    }
  }));
  results.flat().forEach((row) => {
    lookupKeys(row.path || '').forEach((key) => {
      if (key) map.set(key, row);
    });
  });
  return map;
}

/**
 * Read a meta tag value from a document.
 * @param {Document} doc
 * @param {string} selector
 * @returns {string}
 */
function metaContent(doc, selector) {
  return doc.querySelector(selector)?.getAttribute('content')?.trim() || '';
}

/**
 * Build fetch candidates for a linked page.
 * @param {string} href
 * @returns {string[]}
 */
function pageFetchCandidates(href) {
  try {
    const url = new URL(href, window.location.origin);
    if (!url.pathname.endsWith('.html') && !url.pathname.endsWith('.plain.html')) {
      return [`${url.pathname}.html`, `${url.pathname}.plain.html`, url.pathname];
    }
    return [url.pathname];
  } catch {
    return [href];
  }
}

/**
 * Parse title/description/image from HTML markup.
 * @param {string} html
 * @param {string} href
 * @returns {object|null}
 */
function recordFromHtml(html, href) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = metaContent(doc, 'meta[property="og:title"]')
    || metaContent(doc, 'meta[name="title"]')
    || doc.querySelector('title')?.textContent?.trim()
    || doc.querySelector('h1')?.textContent?.trim()
    || '';
  const description = metaContent(doc, 'meta[name="description"]')
    || metaContent(doc, 'meta[property="og:description"]')
    || '';
  const image = metaContent(doc, 'meta[property="og:image"]')
    || metaContent(doc, 'meta[name="image"]')
    || doc.querySelector('main img, .hero img, img')?.getAttribute('src')
    || '';
  if (!(title || description || image)) return null;
  return {
    path: normalizePath(href),
    title,
    description,
    image,
  };
}

/**
 * Fetch title/description/image from the linked page itself (author/UE/preview).
 * Used when the query index is missing or incomplete.
 * @param {string} href
 * @returns {Promise<object|null>}
 */
async function fetchPageRecord(href) {
  const responses = await Promise.all(pageFetchCandidates(href).map(async (path) => {
    try {
      const resp = await fetch(path, { credentials: 'same-origin' });
      if (!resp.ok) return null;
      return recordFromHtml(await resp.text(), href);
    } catch {
      return null;
    }
  }));
  return responses.find(Boolean) || null;
}

/**
 * True when an index row already has the fields we need for a card.
 * @param {object|undefined} record
 * @returns {boolean}
 */
function isComplete(record) {
  return Boolean(record?.title && record?.description && record?.image);
}

/**
 * Collect authored page links from the block rows.
 * @param {Element} block
 * @returns {Array<{ href: string, label: string, row: Element }>}
 */
function getAuthoredLinks(block) {
  return [...block.children]
    .map((row) => {
      const link = row.querySelector('a[href]');
      if (!link) return null;
      return {
        href: link.href,
        label: link.textContent.trim(),
        row,
      };
    })
    .filter(Boolean);
}

/**
 * Find an index record for a link using normalized path variants.
 * @param {Map<string, object>} records
 * @param {string} href
 * @returns {object|undefined}
 */
function findRecord(records, href) {
  return lookupKeys(href)
    .map((key) => records.get(key))
    .find(Boolean);
}

/**
 * Render one related-link card from index (or link fallback).
 * @param {{ href: string, label: string, row: Element }} item
 * @param {object|undefined} record
 * @returns {HTMLLIElement}
 */
function renderCard(item, record) {
  const li = document.createElement('li');
  li.className = 'related-links-item';
  moveInstrumentation(item.row, li);

  const path = normalizePath(item.href);
  const title = record?.title || item.label || path;
  const description = record?.description || '';
  const image = record?.image || '';

  const article = document.createElement('article');
  article.className = 'related-links-card';

  if (image) {
    const media = document.createElement('div');
    media.className = 'related-links-image';
    media.append(createOptimizedPicture(image, title, false, [{ width: '750' }]));
    article.append(media);
  }

  const body = document.createElement('div');
  body.className = 'related-links-body';

  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = item.href;
  link.textContent = title;
  heading.append(link);
  body.append(heading);

  if (description) {
    const p = document.createElement('p');
    p.textContent = description;
    body.append(p);
  }

  article.append(body);
  li.append(article);
  return li;
}

/**
 * Related links: authors provide page links only; title/description/image
 * are resolved from the site query index, with a same-origin page fetch fallback
 * for Universal Editor / unpublished pages.
 * @param {Element} block
 */
export default async function decorate(block) {
  const links = getAuthoredLinks(block);
  if (!links.length) {
    block.textContent = '';
    return;
  }

  let records = new Map();
  try {
    records = await loadIndexMap();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('related-links: unable to load query index', e);
  }

  const resolved = await Promise.all(links.map(async (item) => {
    let record = findRecord(records, item.href);
    if (!isComplete(record)) {
      const fetched = await fetchPageRecord(item.href);
      if (fetched) {
        record = {
          title: fetched.title || record?.title,
          description: fetched.description || record?.description,
          image: fetched.image || record?.image,
          path: fetched.path,
        };
      }
    }
    return { item, record };
  }));

  const ul = document.createElement('ul');
  ul.className = 'related-links-list';
  resolved.forEach(({ item, record }) => {
    ul.append(renderCard(item, record));
  });

  block.replaceChildren(ul);
}
