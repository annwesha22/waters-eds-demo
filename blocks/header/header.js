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

function slugify(name) {
  return name.toLowerCase().trim().replace(/&/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [String(raw)];
  try { return JSON.parse(raw); } catch { /* not JSON */ }
  return raw.replace(/^"|"$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
}

async function fetchTaxonomy() {
  const map = {};
  try {
    const resp = await fetch('/blog/taxonomy.json');
    if (!resp.ok) return map;
    const json = await resp.json();

    const sheetNames = json[':names'] || Object.keys(json).filter((k) => json[k] && json[k].data);
    const allRows = [];
    if (sheetNames.length) {
      sheetNames.forEach((s) => { if (json[s] && json[s].data) allRows.push(...json[s].data); });
    } else if (json.data) {
      allRows.push(...json.data);
    }

    allRows.forEach((r) => {
      const name = r.Author || r.Tag || r.Category || r.Name || r.Title;
      const slug = r.Slug;
      if (name && slug) map[name.trim().toLowerCase()] = slug;
    });
  } catch { /* ignore */ }
  return map;
}

async function fetchSearchData() {
  try {
    const resp = await fetch('/blog/metadata.json');
    if (!resp.ok) return [];
    const json = await resp.json();
    const rows = json.data || [];
    return rows
      .filter((r) => r.URL && !r.URL.includes('*'))
      .map((r) => ({
        path: r.URL,
        title: r.title || '',
        description: r.description || '',
        author: r.author || '',
        category: r.category || '',
        tags: r['article:tag'] || '',
        image: r['og:image'] || r['og-image'] || r.image || '',
      }));
  } catch {
    return [];
  }
}

function categoriesOf(item) {
  return item.category
    ? item.category.split(',').map((c) => c.trim().replace(/^"|"$/g, '')).filter(Boolean)
    : [];
}

function tagsOf(item) {
  return parseTags(item.tags);
}

function authorsOf(items) {
  return [...new Set(items.map((item) => item.author?.trim()).filter(Boolean))];
}

function buildSearchEntities(items, taxonomy) {
  const entities = [];

  const categories = new Set();
  items.forEach((item) => categoriesOf(item).forEach((c) => categories.add(c)));
  categories.forEach((category) => {
    const slug = taxonomy[category.toLowerCase()] || slugify(category);
    entities.push({ type: 'category', title: category, path: `/blog/categories/${slug}` });
  });

  const tags = new Set();
  items.forEach((item) => tagsOf(item).forEach((t) => tags.add(t)));
  tags.forEach((tag) => {
    const slug = taxonomy[tag.toLowerCase()] || slugify(tag);
    entities.push({ type: 'tag', title: tag, path: `/blog/tags/${slug}` });
  });

  authorsOf(items).forEach((author) => {
    const slug = taxonomy[author.toLowerCase()] || slugify(author);
    entities.push({ type: 'author', title: author, path: `/blog/author/${slug}` });
  });

  return entities;
}

function matchesQuery(item, query) {
  const q = query.toLowerCase();
  return [item.title, item.description, item.author, item.category, ...parseTags(item.tags)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(q));
}

function resolveDestination(query, items, taxonomy) {
  const q = query.toLowerCase().trim();
  const entities = buildSearchEntities(items, taxonomy);

  const exactEntity = entities.find((e) => e.title.toLowerCase() === q);
  if (exactEntity) return exactEntity.path;

  const exactArticle = items.find((item) => item.title.toLowerCase() === q);
  if (exactArticle) return exactArticle.path;

  const partialEntity = entities.find((e) => e.title.toLowerCase().includes(q));
  if (partialEntity) return partialEntity.path;

  const article = items.find((item) => matchesQuery(item, q));
  return article?.path || null;
}

function renderSearchResults(resultsEl, items, query, taxonomy) {
  if (!query) {
    resultsEl.innerHTML = '';
    resultsEl.hidden = true;
    return;
  }

  const entities = buildSearchEntities(items, taxonomy);

  const articleResults = items
    .filter((item) => matchesQuery(item, query))
    .slice(0, 5)
    .map((item) => ({
      type: 'article',
      title: item.title,
      category: categoriesOf(item)[0] || '',
      author: item.author || '',
      path: item.path,
    }));

  const entityResults = entities
    .filter((entity) => entity.title.toLowerCase().includes(query))
    .slice(0, 3);

  const results = [...entityResults, ...articleResults].slice(0, 8);

  if (!results.length) {
    resultsEl.innerHTML = '<p class="search-no-results">No results found</p>';
    resultsEl.hidden = false;
    return;
  }

  const metaLabel = { author: 'Author', category: 'Category', tag: 'Tag' };

  resultsEl.innerHTML = results.map((item) => {
    const meta = metaLabel[item.type]
      || `${item.category || ''}${item.author ? ` • ${item.author}` : ''}`;
    return `
      <a class="search-result" href="${item.path}">
        <div class="search-result-content">
          <span class="search-result-title">${item.title}</span>
          <span class="search-result-meta">${meta}</span>
        </div>
      </a>
    `;
  }).join('');

  resultsEl.hidden = false;
}

function initSearch(el) {
  const placeholder = el.querySelector('p')?.textContent?.trim() || 'Search topics, titles and authors';

  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'search-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = placeholder;

  const btn = document.createElement('button');
  btn.className = 'search-btn';
  btn.setAttribute('aria-label', 'Search');
  btn.innerHTML = '<svg class="icon icon-search"><use href="/img/icons/search.svg#search"></use></svg>';

  const results = document.createElement('div');
  results.className = 'search-results';
  results.hidden = true;

  let dataPromise = null;
  const ensureData = () => {
    if (!dataPromise) {
      dataPromise = Promise.all([fetchSearchData(), fetchTaxonomy()])
        .then(([items, taxonomy]) => ({ items, taxonomy }));
    }
    return dataPromise;
  };

  const runSearch = async () => {
    const query = input.value.trim().toLowerCase();
    const { items, taxonomy } = await ensureData();
    renderSearchResults(results, items, query, taxonomy);
  };

  const submit = async () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      input.focus();
      return;
    }
    const { items, taxonomy } = await ensureData();
    const dest = resolveDestination(query, items, taxonomy);
    if (dest) window.location.href = dest;
  };

  input.addEventListener('focus', ensureData);
  input.addEventListener('input', runSearch);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submit();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  document.addEventListener('click', (e) => {
    if (!el.contains(e.target)) results.hidden = true;
  });

  wrapper.append(input, btn);
  el.append(wrapper, results);
}

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
  document.addEventListener('click', docClose);
  menu.classList.add('is-open');
}

function decorateLanguage(btn) {
  const utilityLi = btn.closest('li') || btn.closest('.utility-action-item');
  if (!utilityLi) return;

  btn.removeAttribute('onclick');

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    let menu = utilityLi.querySelector('.language.menu');
    if (!menu) {
      const fragment = await loadFragment(`${locale.prefix}${HEADER_PATH}/languages`);

      menu = document.createElement('div');
      menu.className = 'language menu';

      const rawUl = fragment.querySelector('ul');
      if (rawUl) {
        rawUl.className = 'language-menu-list';
        [...rawUl.children].forEach((li) => {
          li.className = 'language-menu-item';
          const a = li.querySelector('a');
          if (a) a.className = 'language-menu-link';
        });
        menu.append(rawUl);
      } else {
        menu.append(fragment);
      }

      utilityLi.append(menu);
    }

    toggleMenu(utilityLi);
  });
}

function decorateScheme(btn) {
  btn.addEventListener('click', async () => {
    const { body } = document;

    let currPref = localStorage.getItem('color-scheme');
    if (!currPref) {
      currPref = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-scheme' : 'light-scheme';
    }

    const theme = currPref === 'dark-scheme'
      ? { add: 'light-scheme', remove: 'dark-scheme' }
      : { add: 'dark-scheme', remove: 'light-scheme' };

    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    localStorage.setItem('color-scheme', theme.add);

    const sections = document.querySelectorAll('.section');
    for (const section of sections) setColorScheme(section);
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

function decorateCategoriesDropdown(li) {
  const wrapper = document.createElement('div');
  wrapper.className = 'single-menu';
  const inner = document.createElement('div');
  inner.className = 'single-menu-inner';

  const ul = document.createElement('ul');
  ul.className = 'single-menu-list';

  inner.append(ul);
  wrapper.append(inner);
  li.append(wrapper);

  fetch('/blog/taxonomy.json')
    .then((response) => {
      if (!response.ok) throw new Error('Failed to fetch categories spreadsheet');
      return response.json();
    })
    .then((json) => {
      const sheetNames = json[':names'] || Object.keys(json).filter((k) => json[k]?.data);

      let rows = [];
      if (sheetNames.length) {
        sheetNames.forEach((sheet) => {
          if (json[sheet]?.data) rows.push(...json[sheet].data);
        });
      } else {
        rows = json.data || [];
      }

      rows.forEach((row) => {
        const category = row.Category?.trim() || row.category?.trim();
        const slug = row.Slug?.trim() || row.slug?.trim();
        if (!category || !slug) return;

        const item = document.createElement('li');
        item.className = 'single-menu-item';

        const a = document.createElement('a');
        a.className = 'single-menu-link';
        a.href = `/blog/categories/${slug}`;
        a.textContent = category;

        item.append(a);
        ul.append(item);
      });
    })
    .catch((err) => console.error('Error loading dynamic categories:', err));
}

function decorateNavItem(li) {
  li.classList.add('main-nav-item');

  const link = li.querySelector(':scope > p > a') || li.querySelector(':scope > a');

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
  const linkText = currentLink
    ? currentLink.textContent.trim().toLowerCase()
    : li.textContent.trim().toLowerCase();

  if (!linkText.includes('categories')) return;

  li.classList.add('has-dropdown');
  decorateCategoriesDropdown(li);

  if (currentLink) {
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

  const textNode = [...brandLink.childNodes]
    .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
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
  for (const navItem of mainNavItems) decorateNavItem(navItem);
}

function decorateActionSection(section) {
  section.classList.add('actions-section');
  const items = section.querySelectorAll('li');

  items.forEach((item) => {
    const text = item.textContent.trim().toLowerCase();
    if (text === 'search') {
      item.textContent = '';
      const searchBlock = document.createElement('div');
      searchBlock.className = 'search';
      item.append(searchBlock);
      initSearch(searchBlock);
    }
  });
}

function buildUtilityBar(utilitySection) {
  const topUtilityContent = utilitySection.querySelector('.default-content');
  if (!topUtilityContent) return;

  const langWrapper = utilitySection.querySelector('.action-wrapper.globe')
    || utilitySection.querySelector('.action-wrapper.language');

  if (langWrapper) {
    let utilityUl = topUtilityContent.querySelector('ul');
    if (!utilityUl) {
      utilityUl = document.createElement('ul');
      topUtilityContent.append(utilityUl);
    }

    let utilityLi = langWrapper.closest('li');
    if (!utilityLi) {
      utilityLi = document.createElement('li');
      utilityLi.append(langWrapper);
    }

    utilityLi.className = 'utility-action-item';
    utilityUl.append(utilityLi);

    const btn = langWrapper.querySelector('button');
    if (btn) decorateLanguage(btn);
  }

  [...topUtilityContent.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .forEach((node) => {
      if (node.textContent.trim().toLowerCase() === 'language') node.remove();
    });
}

function buildMainHeaderRow(brandSection, navSection) {
  const mainHeaderRow = document.createElement('div');
  mainHeaderRow.className = 'main-header-row';

  const brandContent = brandSection.querySelector('.default-content');
  if (brandContent) mainHeaderRow.append(brandContent);

  const navElement = document.createElement('nav');
  const mainNavList = navSection.querySelector('.main-nav-list');
  if (mainNavList) navElement.append(mainNavList);
  mainHeaderRow.append(navElement);

  const searchBlock = navSection.querySelector('.search');
  if (searchBlock) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions-wrapper-right';
    actionsDiv.append(searchBlock);
    mainHeaderRow.append(actionsDiv);
  }

  return mainHeaderRow;
}

async function decorateHeader(fragment) {
  const sections = fragment.querySelectorAll(':scope > .section');

  if (sections.length === 3) {
    sections[0].classList.add('top-utility-section');

    decorateActionSection(sections[2]);
    decorateBrandSection(sections[1]);
    decorateNavSection(sections[2]);

    for (const pattern of HEADER_ACTIONS) {
      await decorateAction(fragment, pattern);
    }

    const mainHeaderRow = buildMainHeaderRow(sections[1], sections[2]);
    buildUtilityBar(sections[0]);

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