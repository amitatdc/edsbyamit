import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const SITE_PREFIXES = ['/content/eba', '/content/edsbyamit'];

/** EDS delivery hosts used when author/UE cannot serve /query-index.json. */
const EDS_INDEX_ORIGINS = [
  'https://main--edsbyamit--amitatdc.aem.page',
  'https://main--edsbyamit--amitatdc.aem.live',
];

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
 * True when running inside AEM author / Universal Editor.
 * @returns {boolean}
 */
function isAuthorHost() {
  const { hostname } = window.location;
  return hostname.includes('adobeaemcloud.com')
    || hostname.startsWith('author-')
    || hostname.includes('localhost');
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
  // Prefer public EDS indexes as a fallback when author proxy data is stale.
  if (isAuthorHost()) {
    EDS_INDEX_ORIGINS.forEach((origin) => {
      urls.push(`${origin}/query-index.json`);
    });
  }
  return urls;
}

/**
 * Load query index data (supports single-sheet JSON).
 * Same-origin author indexes require cookies; cross-origin EDS indexes use omit.
 * @param {string} indexUrl
 * @returns {Promise<Array<object>>}
 */
async function loadIndex(indexUrl) {
  const crossOrigin = /^https?:\/\//i.test(indexUrl);
  const resp = await fetch(indexUrl, {
    credentials: crossOrigin ? 'omit' : 'same-origin',
  });
  if (!resp.ok) throw new Error(`Failed to load index: ${indexUrl}`);
  const json = await resp.json();
  if (Array.isArray(json.data)) return json.data;
  if (json[':type'] === 'multi-sheet' && json.default?.data) return json.default.data;
  return [];
}

/**
 * Try each index URL until rows are found.
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
 * Reject broken Edge Delivery placeholders.
 * @param {string} image
 * @returns {string}
 */
function sanitizeImage(image) {
  if (!image) return '';
  const value = String(image).trim();
  const lower = value.toLowerCase();
  if (lower.includes('about:error') || lower.includes('nullerror')) return '';
  return value;
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
 * Build fetch candidates for a linked page (author + EDS delivery).
 * @param {string} href
 * @returns {string[]}
 */
function pageFetchCandidates(href) {
  const candidates = [];
  const publicPath = normalizePath(href);

  try {
    const url = new URL(href, window.location.origin);
    if (!url.pathname.endsWith('.html') && !url.pathname.endsWith('.plain.html')) {
      candidates.push(`${url.pathname}.html`, `${url.pathname}.plain.html`, url.pathname);
    } else {
      candidates.push(url.pathname);
    }
  } catch {
    candidates.push(href);
  }

  // Prefer published EDS markup when author meta/images are still broken.
  EDS_INDEX_ORIGINS.forEach((origin) => {
    candidates.push(`${origin}${publicPath}`, `${origin}${publicPath}.plain.html`);
  });

  return [...new Set(candidates)];
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
  const imgs = [...doc.querySelectorAll('main img, img')]
    .map((img) => sanitizeImage(img.getAttribute('src') || ''))
    .filter(Boolean);
  const image = sanitizeImage(metaContent(doc, 'meta[property="og:image"]'))
    || sanitizeImage(metaContent(doc, 'meta[name="image"]'))
    || imgs[0]
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
 * Fetch title/description/image from linked page / EDS delivery.
 * @param {string} href
 * @returns {Promise<object|null>}
 */
async function fetchPageRecord(href) {
  const responses = await Promise.all(pageFetchCandidates(href).map(async (path) => {
    try {
      const resp = await fetch(path, {
        credentials: path.startsWith('http') ? 'omit' : 'same-origin',
      });
      if (!resp.ok) return null;
      return recordFromHtml(await resp.text(), href);
    } catch {
      return null;
    }
  }));

  // Prefer the richest record (title + description + usable image).
  return responses
    .filter(Boolean)
    .sort((a, b) => {
      const score = (r) => (r.title ? 1 : 0) + (r.description ? 1 : 0) + (r.image ? 1 : 0);
      return score(b) - score(a);
    })[0] || null;
}

/**
 * True when an index/page record has enough fields for a useful card.
 * Image is optional (author may still have about:error until republish).
 * @param {object|undefined} record
 * @returns {boolean}
 */
function hasCardContent(record) {
  return Boolean(record?.title && record?.description);
}

/**
 * Human label when authored link text is a raw content path.
 * @param {string} label
 * @param {string} href
 * @returns {string}
 */
function displayLabel(label, href) {
  if (!label) return normalizePath(href);
  if (label.startsWith('/content/') || label === href) return normalizePath(href);
  return label;
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
  const match = lookupKeys(href)
    .map((key) => records.get(key))
    .find(Boolean);
  if (!match) return undefined;
  return {
    ...match,
    image: sanitizeImage(match.image),
  };
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
  const title = record?.title || displayLabel(item.label, item.href) || path;
  const description = record?.description || '';
  const image = sanitizeImage(record?.image || '');

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
 * resolve from the query index. On Universal Editor / author, also tries the
 * public EDS index and linked-page metadata because author has no /query-index.json.
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
    if (!hasCardContent(record) || !sanitizeImage(record?.image)) {
      const fetched = await fetchPageRecord(item.href);
      if (fetched) {
        record = {
          title: record?.title || fetched.title,
          description: record?.description || fetched.description,
          image: sanitizeImage(record?.image) || fetched.image,
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
