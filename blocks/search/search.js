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
      const name = r.Tag || r.Name || r.Category;
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
  const fromCategory = item.category
    ? item.category.split(',').map((c) => c.trim().replace(/^"|"$/g, '')).filter(Boolean)
    : [];
  const fromTags = parseTags(item.tags);
  return [...new Set([...fromCategory, ...fromTags])];
}

function matchesQuery(item, query) {
  const haystack = [
    item.title,
    item.description,
    item.author,
    item.category,
    parseTags(item.tags).join(' '),
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

// Decide the best destination for a submitted query.
function resolveDestination(query, items, taxonomy) {
  // 1. Category / tag match -> category landing page
  const allCategories = new Set();
  items.forEach((item) => categoriesOf(item).forEach((c) => allCategories.add(c)));

  const categoryMatch = [...allCategories]
    .find((c) => c.toLowerCase() === query)
    || [...allCategories].find((c) => c.toLowerCase().includes(query));
  if (categoryMatch) {
    const slug = taxonomy[categoryMatch.toLowerCase()] || slugify(categoryMatch);
    return `/blog/categories/${slug}`;
  }

  // 2. Author match -> author landing page
  const authors = items.map((item) => item.author).filter(Boolean);
  const authorMatch = authors.find((a) => a.toLowerCase() === query)
    || authors.find((a) => a.toLowerCase().includes(query));
  if (authorMatch) {
    return `/blog/author/${slugify(authorMatch)}`;
  }

  // 3. Fall back to first matching article
  const article = items.find((item) => matchesQuery(item, query));
  return article ? article.path : null;
}

function renderResults(resultsEl, items, query) {
  if (!query) {
    resultsEl.innerHTML = '';
    resultsEl.hidden = true;
    return;
  }

  const matches = items.filter((item) => matchesQuery(item, query)).slice(0, 8);

  if (!matches.length) {
    resultsEl.innerHTML = '<p class="search-no-results">No results found</p>';
    resultsEl.hidden = false;
    return;
  }

  resultsEl.innerHTML = matches.map((item) => {
    const category = categoriesOf(item)[0] || '';
    return `
      <a class="search-result" href="${item.path}">
        <span class="search-result-title">${item.title}</span>
        ${category ? `<span class="search-result-category">${category}</span>` : ''}
      </a>
    `;
  }).join('');
  resultsEl.hidden = false;
}

export default function init(el) {
  const placeholder = el.querySelector('p')?.textContent?.trim() || 'Search topics, titles, and authors';

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
  btn.innerHTML = `<svg class="icon icon-search">
    <use href="/img/icons/search.svg#search"></use>
  </svg>`;

  const results = document.createElement('div');
  results.className = 'search-results';
  results.hidden = true;

  // Lazy-load metadata + taxonomy once. Absolute paths => works on ANY page.
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
    const { items } = await ensureData();
    renderResults(results, items, query);
  };

  const submit = async () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      input.focus();
      return;
    }
    const { items, taxonomy } = await ensureData();
    const dest = resolveDestination(query, items, taxonomy);
    if (dest) {
      window.location.href = dest;
    }
  };

  // Preload data as soon as the user interacts
  input.addEventListener('focus', ensureData);

  // Live dropdown as the user types
  input.addEventListener('input', runSearch);

  // Click the search icon/button -> trigger the action
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submit();
  });

  // Enter key in the input -> trigger the action
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  // Hide results when clicking outside the block
  document.addEventListener('click', (e) => {
    if (!el.contains(e.target)) {
      results.hidden = true;
    }
  });

  wrapper.append(input, btn);
  el.append(wrapper, results);
}
