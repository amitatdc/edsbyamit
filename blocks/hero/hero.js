/**
 * loads and decorates the hero block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const isHome = block.classList.contains('home');

  // Flatten authored rows into a predictable structure
  const rows = [...block.children];
  rows.forEach((row) => {
    [...row.children].forEach((col) => {
      if (col.querySelector('picture')) {
        col.classList.add('hero-image');
      } else {
        col.classList.add('hero-content');
      }
    });
  });

  if (!isHome) return;

  // Home variant: turn the first link into a search affordance
  const content = block.querySelector('.hero-content');
  if (!content) return;

  const searchLink = content.querySelector('a');
  if (!searchLink) return;

  const form = document.createElement('form');
  form.className = 'hero-search';
  form.setAttribute('role', 'search');
  form.action = searchLink.href;
  form.method = 'get';

  const label = document.createElement('label');
  label.className = 'sr-only';
  label.htmlFor = 'hero-search-input';
  label.textContent = 'Search';

  const input = document.createElement('input');
  input.type = 'search';
  input.id = 'hero-search-input';
  input.name = 'q';
  input.placeholder = searchLink.textContent.trim();
  input.required = true;

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Search';

  form.append(label, input, button);
  searchLink.replaceWith(form);
}
