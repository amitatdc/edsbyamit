import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function classifyColumns(item) {
  [...item.children].forEach((col) => {
    if (col.querySelector('picture')) col.className = 'featured-updates-image';
    else col.className = 'featured-updates-body';
  });
}

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });
}

/**
 * Featured updates: first row is large feature; remaining rows stack as list.
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const [first, ...rest] = rows;
  const feature = document.createElement('article');
  feature.className = 'featured-updates-feature';
  moveInstrumentation(first, feature);
  while (first.firstElementChild) feature.append(first.firstElementChild);
  classifyColumns(feature);

  const list = document.createElement('ul');
  list.className = 'featured-updates-list';
  rest.forEach((row) => {
    const item = document.createElement('li');
    item.className = 'featured-updates-item';
    moveInstrumentation(row, item);
    while (row.firstElementChild) item.append(row.firstElementChild);
    classifyColumns(item);
    list.append(item);
  });

  block.replaceChildren(feature, list);
  optimizeImages(block);
}
