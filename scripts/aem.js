/* eslint-env browser */

/**
 * Minimal hlx setup — decorateIcon depends on window.hlx.codeBasePath
 * to resolve the /icons/*.svg paths.
 */
function setup() {
  window.hlx = window.hlx || {};
  if (typeof window.hlx.codeBasePath !== 'string') {
    window.hlx.codeBasePath = '';
  }
}

setup();

/**
 * Add <img> for icon, prefixed with codeBasePath and optional prefix.
 * @param {Element} [span] span element with icon classes
 * @param {string} [prefix] prefix to be added to icon src
 * @param {string} [alt] alt text to be added to icon
 */
function decorateIcon(span, prefix = '', alt = '') {
  if (span.hasChildNodes()) return; // already decorated
  const iconClass = Array.from(span.classList).find((c) => c.startsWith('icon-'));
  if (!iconClass) return; // no icon-<name> class, nothing to decorate
  const iconName = iconClass.substring(5);
  const img = document.createElement('img');
  img.dataset.iconName = iconName;
  img.src = `${window.hlx.codeBasePath}${prefix}/icons/${iconName}.svg`;
  img.alt = alt;
  img.loading = 'lazy';
  img.width = 16;
  img.height = 16;
  span.append(img);
}

/**
 * Add <img> for icons, prefixed with codeBasePath and optional prefix.
 * @param {Element} [element] Element containing icons
 * @param {string} [prefix] prefix to be added to icon the src
 */
function decorateIcons(element, prefix = '') {
  if (!element) return;
  const icons = element.querySelectorAll('span.icon');
  icons.forEach((span) => {
    decorateIcon(span, prefix);
  });
}

export { decorateIcon, decorateIcons, setup };