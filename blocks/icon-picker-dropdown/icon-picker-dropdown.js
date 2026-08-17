import { decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const ICON_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Resolves the icon a cell describes, either an already decorated icon span
 * (`:name:` shorthand in a document) or a bare icon name (dropdown in the editor).
 * @param {Element} cell the candidate icon cell
 * @returns {Element|null} an icon span, or null when the cell holds no icon
 */
function toIconSpan(cell) {
  const authored = cell.querySelector('span.icon');
  if (authored) return authored;

  const name = cell.textContent.trim().toLowerCase();
  if (!ICON_NAME.test(name)) return null;

  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  return span;
}

/**
 * loads and decorates the icon list
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    const cells = [...row.children];
    const icon = cells.length > 1 ? toIconSpan(cells[0]) : null;
    if (icon) {
      cells.shift();
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'icon-picker-dropdown-icon';
      iconWrapper.append(icon);
      li.append(iconWrapper);
    }

    const body = document.createElement('div');
    body.className = 'icon-picker-dropdown-body';
    cells.forEach((cell) => body.append(...cell.childNodes));
    li.append(body);

    ul.append(li);
  });

  block.replaceChildren(ul);
  decorateIcons(block);

  // an icon name with no matching file in /icons would otherwise show a broken image
  block.querySelectorAll('.icon-picker-dropdown-icon img').forEach((img) => {
    img.addEventListener('error', () => img.closest('.icon-picker-dropdown-icon').remove());
  });
}
