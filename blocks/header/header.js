import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';

const { locale } = getConfig();

const FALLBACK_LOCALE = 'en';

const HEADER_ACTIONS = [
  '/tools/widgets/language',
  '/tools/widgets/search',
  '/tools/widgets/toggle',
];

/**
 * Returns current locale from URL/config
 */
function getCurrentLocale() {
  return locale?.prefix?.replace('/', '') || FALLBACK_LOCALE;
}

/**
 * Build locale-specific header path
 */
function getHeaderPath(localeCode) {
  return `/fragments/nav/${localeCode}/header`;
}

/**
 * Fetch localization sheet
 */
async function getLocales() {
  try {
    const resp = await fetch(
      '/docs/library/metadata/localization.json',
    );

    if (!resp.ok) {
      throw new Error('Localization sheet not found');
    }

    const json = await resp.json();

    return json.data || [];
  } catch (e) {
    console.warn('Unable to load localization config', e);

    return [
      { locale: 'en', label: 'English' },
    ];
  }
}

/**
 * Close all open menus
 */
function closeAllMenus() {
  document
    .querySelectorAll('header .is-open')
    .forEach((menu) => menu.classList.remove('is-open'));
}

function docClose(e) {
  if (e.target.closest('header')) return;
  closeAllMenus();
}

function toggleMenu(menu) {
  const isOpen = menu.classList.contains('is-open');

  closeAllMenus();

  if (isOpen) {
    document.removeEventListener('click', docClose);
    return;
  }

  document.addEventListener('click', docClose);
  menu.classList.add('is-open');
}

/**
 * Language Selector
 */
async function decorateLanguage(btn) {
  const locales = await getLocales();

  btn.addEventListener('click', () => {
    let menu = document.querySelector('.language-selector-menu');

    if (menu) {
      menu.remove();
      return;
    }

    const currentLocale = getCurrentLocale();

    menu = document.createElement('div');
    menu.className = 'language-selector-menu';

    locales.forEach((lang) => {
      const option = document.createElement('button');

      option.className = 'language-option';
      option.textContent = lang.label;

      if (lang.locale === currentLocale) {
        option.classList.add('active');
      }

      option.addEventListener('click', () => {
        const path = window.location.pathname;

        const newPath = path.replace(
          /^\/(en|fr|de|es)/,
          `/${lang.locale}`,
        );

        window.location.href = newPath;
      });

      menu.append(option);
    });

    btn.parentElement.append(menu);
  });
}

/**
 * Search Action
 */
function decorateSearch(btn) {
  btn.addEventListener('click', () => {
    document.body.classList.toggle('search-open');

    const searchInput = document.querySelector(
      '.header-search input[type="search"]',
    );

    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  });
}

/**
 * Mobile Toggle
 */
function decorateNavToggle(btn) {
  btn.addEventListener('click', () => {
    const header = document.querySelector('header');

    if (header) {
      header.classList.toggle('is-mobile-open');
    }
  });
}

/**
 * Action Decorator
 */
function decorateAction(header, pattern) {
  const link = header.querySelector(`[href*="${pattern}"]`);

  if (!link) return;

  const icon = link.querySelector('.icon');
  const text = link.textContent.trim();

  const btn = document.createElement('button');
  btn.type = 'button';

  if (icon) btn.append(icon);

  if (text) {
    const span = document.createElement('span');
    span.className = 'text';
    span.textContent = text;
    btn.append(span);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'action-wrapper';
  wrapper.append(btn);

  link.parentElement.parentElement.replaceChild(
    wrapper,
    link.parentElement,
  );

  if (pattern === '/tools/widgets/language') {
    decorateLanguage(btn);
  }

  if (pattern === '/tools/widgets/search') {
    decorateSearch(btn);
  }

  if (pattern === '/tools/widgets/toggle') {
    decorateNavToggle(btn);
  }
}

/**
 * Mega Menu Support
 */
function decorateMegaMenu(li) {
  const menu = li.querySelector('.fragment-content');

  if (!menu) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'mega-menu';

  wrapper.append(menu);

  li.append(wrapper);
  li.classList.add('has-dropdown');

  return wrapper;
}

function decorateNavItem(li) {
  li.classList.add('main-nav-item');

  const link = li.querySelector(':scope > p > a');

  if (link) {
    link.classList.add('main-nav-link');
  }

  const menu = decorateMegaMenu(li);

  if (menu && link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu(li);
    });
  }
}

/**
 * Brand Section
 */
function decorateBrandSection(section) {
  section.classList.add('brand-section');

  const link = section.querySelector('a');

  if (!link) return;

  link.classList.add('brand-link');

  const img = link.querySelector('img');

  if (img) {
    img.classList.add('brand-logo');
  }
}

/**
 * Navigation Section
 */
function decorateNavSection(section) {
  section.classList.add('main-nav-section');

  const navList = section.querySelector('ul');

  if (!navList) return;

  navList.classList.add('main-nav-list');

  const nav = document.createElement('nav');
  nav.append(navList);

  section.append(nav);

  nav.querySelectorAll(':scope > ul > li')
    .forEach((item) => decorateNavItem(item));
}

/**
 * Actions Section
 */
function decorateActionSection(section) {
  section.classList.add('actions-section');
}

/**
 * Header Decorator
 */
async function decorateHeader(fragment) {
  const sections = fragment.querySelectorAll(':scope > .section');

  if (sections[0]) decorateBrandSection(sections[0]);
  if (sections[1]) decorateNavSection(sections[1]);
  if (sections[2]) decorateActionSection(sections[2]);

  HEADER_ACTIONS.forEach((action) => {
    decorateAction(fragment, action);
  });
}

/**
 * Try loading header fragment
 */
async function loadHeader(path) {
  try {
    return await loadFragment(path);
  } catch {
    return null;
  }
}

/**
 * Initialize Header
 */
export default async function init(el) {
  const currentLocale = getCurrentLocale();

  const headerMeta = getMetadata('header');

  const localizedHeader =
    headerMeta || getHeaderPath(currentLocale);

  let fragment = await loadHeader(localizedHeader);

  if (!fragment) {
    fragment = await loadHeader(
      getHeaderPath(FALLBACK_LOCALE),
    );
  }

  if (!fragment) {
    console.error('Header fragment not found');
    return;
  }

  fragment.classList.add('header-content');

  await decorateHeader(fragment);

  el.append(fragment);
}