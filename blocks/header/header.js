import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import { setColorScheme } from '../section-metadata/section-metadata.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';
const HEADER_ACTIONS = [
  '/tools/widgets/scheme',
  '/tools/widgets/language',
  '/tools/widgets/toggle',
];

function closeAllMenus() {
  const openMenus = document.body.querySelectorAll('header .is-open');
  for (const openMenu of openMenus) {
    openMenu.classList.remove('is-open');
  }
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

  // Setup the global close event
  document.addEventListener('click', docClose);
  menu.classList.add('is-open');
}

function decorateLanguage(btn) {
  // Find the parent list item context wrapping your button natively
  const utilityLi = btn.closest('li') || btn.closest('.utility-action-item');
  if (!utilityLi) return;
  
  btn.removeAttribute('onclick');

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if the dropdown menu already exists inside this list item
    let menu = utilityLi.querySelector('.language.menu');
    if (!menu) {
      // 1. Fetch the raw layout fragment from your authorized path
      const fragment = await loadFragment(`${locale.prefix}${HEADER_PATH}/languages`);
      
      // 2. Create the clean absolute container card
      menu = document.createElement('div');
      menu.className = 'language menu';
      
      // 3. Extract the inner <ul> list elements from your document payload
      const rawUl = fragment.querySelector('ul');
      if (rawUl) {
        rawUl.className = 'language-menu-list';
        
        // Loop through each item to apply standard interactive menu classes
        [...rawUl.children].forEach((li) => {
          li.className = 'language-menu-item';
          
          const a = li.querySelector('a');
          if (a) {
            a.className = 'language-menu-link';
          }
        });
        
        menu.append(rawUl);
      } else {
        // Fallback if no <ul> is found in the fragment
        menu.append(fragment);
      }
      
      // Append right inside the scoped list item wrapper so it inherits absolute tracking coordinates
      utilityLi.append(menu);
    }
    
    // 4. Fire your baseline state manager to toggle the dropdown visibility card
    toggleMenu(utilityLi);
  });
}

function decorateScheme(btn) {
  btn.addEventListener('click', async () => {
    const { body } = document;

    let currPref = localStorage.getItem('color-scheme');
    if (!currPref) {
      currPref = matchMedia('(prefers-color-scheme: dark)')
        .matches ? 'dark-scheme' : 'light-scheme';
    }

    const theme = currPref === 'dark-scheme'
      ? { add: 'light-scheme', remove: 'dark-scheme' }
      : { add: 'dark-scheme', remove: 'light-scheme' };

    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    localStorage.setItem('color-scheme', theme.add);
    // Re-calculatie section schemes
    const sections = document.querySelectorAll('.section');
    for (const section of sections) {
      setColorScheme(section);
    }
  });
}

function decorateNavToggle(btn) {
  btn.addEventListener('click', () => {
    const header = document.body.querySelector('header');
    if (header) header.classList.toggle('is-mobile-open');
  });
}

async function decorateAction(header, pattern) {
  const link = header.querySelector(`[href*="${pattern}"]`);
  if (!link) return;

  const icon = link.querySelector('.icon');
  const text = link.textContent;
  const btn = document.createElement('button');
  if (icon) btn.append(icon);
  if (text) {
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = text;
    btn.append(textSpan);
  }
  const wrapper = document.createElement('div');
  wrapper.className = `action-wrapper ${icon.classList[1].replace('icon-', '')}`;
  wrapper.append(btn);
  link.parentElement.parentElement.replaceChild(wrapper, link.parentElement);

  if (pattern === '/tools/widgets/language') decorateLanguage(btn);
  if (pattern === '/tools/widgets/scheme') decorateScheme(btn);
  if (pattern === '/tools/widgets/toggle') decorateNavToggle(btn);
}

function decorateMenu(li) {
  const submenu = li.querySelector(':scope > ul');
  if (!submenu) return null;

  li.classList.add('has-dropdown');

  const wrapper = document.createElement('div');
  wrapper.className = 'single-menu';
  const inner = document.createElement('div');
  inner.className = 'single-menu-inner';

  submenu.classList.add('single-menu-list');
  inner.append(submenu);
  wrapper.append(inner);

  [...submenu.children].forEach((item) => {
    item.classList.add('single-menu-item');

    const link = item.querySelector('a');
    if (link) {
      link.classList.add('single-menu-link');
    }
  });

  li.append(wrapper);
  return wrapper;
}

function decorateMegaMenu(li) {
  const menu = li.querySelector('.fragment-content');
  if (!menu) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'mega-menu';
  wrapper.append(menu);
  li.append(wrapper);
  return wrapper;
}

function decorateNavItem(li) {
  li.classList.add('main-nav-item');

  const link =
    li.querySelector(':scope > p > a')
    || li.querySelector(':scope > a');

  if (!link) {
    const text = li.textContent.trim();
    if (text && text.toLowerCase() !== 'search') {
      const newLink = document.createElement('a');
      newLink.className = 'main-nav-link';
      newLink.href = '#';
      newLink.textContent = text;
      li.textContent = '';
      li.append(newLink);
    }
  } else {
    link.classList.add('main-nav-link');
  }

  const currentLink = li.querySelector('.main-nav-link');
  const linkText = currentLink ? currentLink.textContent.trim().toLowerCase() : li.textContent.trim().toLowerCase();
  const isCategories = linkText.includes('categories');

  if (isCategories) {
    li.classList.add('has-dropdown');

    const wrapper = document.createElement('div');
    wrapper.className = 'single-menu';
    const inner = document.createElement('div');
    inner.className = 'single-menu-inner';

    const ul = document.createElement('ul');
    ul.className = 'single-menu-list';
    
    inner.append(ul);
    wrapper.append(inner);
    li.append(wrapper);

    fetch('/docs/library/metadata/categories.json')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch categories spreadsheet');
        return response.json();
      })
      .then((json) => {
        const categories = json.data || [];
        categories.forEach((row) => {
          const item = document.createElement('li');
          item.className = 'single-menu-item';

          const a = document.createElement('a');
          a.className = 'single-menu-link';
          a.href = row.path;      
          a.textContent = row.label; 
          
          item.append(a);
          ul.append(item);
        });
      })
      .catch((err) => console.error('Error loading dynamic categories:', err));
  }

  if (isCategories && currentLink) {
    currentLink.classList.add('dropdown-trigger');

    const arrow = document.createElement('span');
    arrow.className = 'dropdown-arrow';
    currentLink.append(arrow);

    currentLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(li);
    });
  }
}

function decorateBrandSection(section) {
  section.classList.add('brand-section');
  const brandLink = section.querySelector('a');
  if (!brandLink) return;

  const textNode = [...brandLink.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) {
    const span = document.createElement('span');
    span.className = 'brand-text-suffix';
    span.textContent = textNode.textContent.trim();
    textNode.remove();
    brandLink.append(span);
  }
}

function decorateNavSection(section) {
  section.classList.add('main-nav-section');
  const navContent = section.querySelector('.default-content');
  const navList = section.querySelector('ul');
  if (!navList) return;
  navList.classList.add('main-nav-list');

  const nav = document.createElement('nav');
  nav.append(navList);
  navContent.append(nav);

  const mainNavItems = section.querySelectorAll('nav > ul > li');
  for (const navItem of mainNavItems) {
    decorateNavItem(navItem);
  }
}

async function decorateActionSection(section) {
  section.classList.add('actions-section');
  const items = section.querySelectorAll('li');

  items.forEach((item) => {
    const text = item.textContent.trim().toLowerCase();

    if (text === 'search') {
      item.textContent = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'search-wrapper';

      const icon = document.createElement('span');
      icon.className = 'search-icon';

      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Search';
      input.className = 'search-input';

      wrapper.append(icon, input);
      item.append(wrapper);
    }
  });
}

async function decorateHeader(fragment) {
  const sections = fragment.querySelectorAll(':scope > .section');
  
  if (sections.length === 3) {
    // 1. Label the top utility strip wrapper natively
    sections[0].classList.add('top-utility-section');
    
    // 2. Run standard baseline action block layout processing elements
    await decorateActionSection(sections[2]);
    
    // 3. Process corporate branding block and main core navigation
    decorateBrandSection(sections[1]);
    decorateNavSection(sections[2]);
    
    // 4. Compile actions completely across all sections (including the utility bar)
    for (const pattern of HEADER_ACTIONS) {
      await decorateAction(fragment, pattern);
    }

    // 5. Create the main horizontal flex row wrapper
    const mainHeaderRow = document.createElement('div');
    mainHeaderRow.className = 'main-header-row';
    
    // Move logo content inside
    const brandContent = sections[1].querySelector('.default-content');
    if (brandContent) {
      mainHeaderRow.append(brandContent);
    }
    
    // Build navigation container
    const navElement = document.createElement('nav');
    const mainNavList = sections[2].querySelector('.main-nav-list');
    if (mainNavList) {
      navElement.append(mainNavList);
    }
    mainHeaderRow.append(navElement);
    
    // Extract and pin the search wrapper block to the right
    const searchWrapper = sections[2].querySelector('.search-wrapper');
    if (searchWrapper) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'actions-wrapper-right';
      actionsDiv.append(searchWrapper);
      mainHeaderRow.append(actionsDiv);
    }

    // --- NEW DIRECT UTILITY INTERACTION BINDING ---
    const topUtilityContent = sections[0].querySelector('.default-content');
    if (topUtilityContent) {
      // Find the language wrapper directly inside the utility section where it was generated
      const langWrapper = sections[0].querySelector('.action-wrapper.globe') || sections[0].querySelector('.action-wrapper.language');
      
      if (langWrapper) {
        // Ensure a clean <ul> container exists inside the utility bar
        let utilityUl = topUtilityContent.querySelector('ul');
        if (!utilityUl) {
          utilityUl = document.createElement('ul');
          topUtilityContent.append(utilityUl);
        }

        // Safely check for or create the <li> item wrapper
        let utilityLi = langWrapper.closest('li');
        if (!utilityLi) {
          utilityLi = document.createElement('li');
          utilityLi.append(langWrapper);
        }
        
        utilityLi.className = 'utility-action-item';
        utilityUl.append(utilityLi); 
          
        // Re-bind the language click event controller to the transformed button element
        const btn = langWrapper.querySelector('button');
        if (btn) {
          decorateLanguage(btn);
        }
      }

      // Clean out raw authored static text nodes cleanly
      const textNodes = [...topUtilityContent.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
      textNodes.forEach(node => {
        if (node.textContent.trim().toLowerCase() === 'language') {
          node.remove();
        }
      });
    }

    // CRITICAL CORRECTION: Append the assembled rows to the DOM and clear old fragments
    sections[0].after(mainHeaderRow);
    sections[1].remove();
    sections[2].remove();
  } else {
    if (sections[0]) decorateBrandSection(sections[0]);
    if (sections[1]) decorateNavSection(sections[1]);
    if (sections[2]) decorateActionSection(sections[2]);
    
    for (const pattern of HEADER_ACTIONS) {
      await decorateAction(fragment, pattern);
    }
  }
}

/**
 * loads and decorates the header
 * @param {Element} el The header element
 */
export default async function init(el) {
  const headerMeta = getMetadata('header');
  const path = headerMeta || HEADER_PATH;
  try {
    const fragment = await loadFragment(`${locale.prefix}${path}`);
    fragment.classList.add('header-content');
    await decorateHeader(fragment);
    el.append(fragment);
  } catch (e) {
    throw Error(e);
  }
}