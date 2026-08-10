/**
 * CTA banner — headline, supporting text, button, optional media.
 * @param {Element} block
 */
export default function decorate(block) {
  const row = block.firstElementChild;
  if (!row) return;

  [...row.children].forEach((col) => {
    if (col.querySelector('picture')) col.classList.add('cta-banner-media');
    else col.classList.add('cta-banner-content');
  });

  const link = block.querySelector('.cta-banner-content a');
  if (link && !link.closest('.button-container')) {
    link.classList.add('button');
  }
}
