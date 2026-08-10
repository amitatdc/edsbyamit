import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Normalize authored/index paths for lookup.
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  if (!path) return '';
  try {
    const url = new URL(path, window.location.origin);
    let { pathname } = url;
    pathname = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    return pathname;
  } catch {
    return path.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  }
}

/**
 * Resolve which query index to use (local drafts vs production).
 * @returns {string}
 */
function getIndexUrl() {
  if (window.location.pathname.startsWith('/drafts/')) {
    return '/drafts/query-index.json';
  }
  return '/query-index.json';
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
 * Build a path → record map from index rows.
 * @param {Array<object>} rows
 * @returns {Map<string, object>}
 */
function indexByPath(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizePath(row.path);
    if (key) map.set(key, row);
  });
  return map;
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
 * are resolved from the site query index for those pages.
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
    const rows = await loadIndex(getIndexUrl());
    records = indexByPath(rows);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('related-links: unable to load query index', e);
  }

  const ul = document.createElement('ul');
  ul.className = 'related-links-list';
  links.forEach((item) => {
    const record = records.get(normalizePath(item.href));
    ul.append(renderCard(item, record));
  });

  block.replaceChildren(ul);
}
