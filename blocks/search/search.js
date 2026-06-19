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
      const name =
      r.Author
      || r.Tag
      || r.Category
      || r.Name
      || r.Title;
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

function authorsOf(items) {
  return [...new Set(
    items
      .map((item) => item.author?.trim())
      .filter(Boolean),
  )];
}

function buildSearchEntities(items, taxonomy) {
  const entities = [];

  // Categories
  const categories = new Set();

  items.forEach((item) => {
    categoriesOf(item).forEach((category) => {
      categories.add(category);
    });
  });

  categories.forEach((category) => {
    const slug = taxonomy[category.toLowerCase()]
      || slugify(category);

    entities.push({
      type: 'category',
      title: category,
      path: `/blog/categories/${slug}`,
    });
  });

  authorsOf(items).forEach((author) => {
  const slug = taxonomy[author.toLowerCase()]
    || slugify(author);

    entities.push({
      type: 'author',
      title: author,
      path: `/blog/author/${slug}`,
    });
  });

  return entities;
}


function matchesQuery(item, query) {
  const q = query.toLowerCase();
  return [
    item.title,
    item.description,
    item.author,
    item.category,
    ...parseTags(item.tags),
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(q));
}

function resolveDestination(query, items, taxonomy) {
  const q = query.toLowerCase().trim();

  const entities = buildSearchEntities(items, taxonomy);

  const exactEntity = entities.find(
    (e) => e.title.toLowerCase() === q,
  );

  if (exactEntity) {
    return exactEntity.path;
  }

  const exactArticle = items.find(
    (item) => item.title.toLowerCase() === q,
  );

  if (exactArticle) {
    return exactArticle.path;
  }
  const partialEntity = entities.find(
    (e) => e.title.toLowerCase().includes(q),
  );

  if (partialEntity) {
    return partialEntity.path;
  }

  const article = items.find(
    (item) => matchesQuery(item, q),
  );

  return article?.path || null;
}

function renderResults(resultsEl, items, query, taxonomy) {
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

  resultsEl.innerHTML = results.map((item) => {
    if (item.type === 'author') {
      return `
        <a class="search-result" href="${item.path}">
          <div class="search-result-content">
            <span class="search-result-title">${item.title}</span>
            <span class="search-result-meta">Author</span>
          </div>
        </a>
      `;
    }

    if (item.type === 'category') {
      return `
        <a class="search-result" href="${item.path}">
          <div class="search-result-content">
            <span class="search-result-title">${item.title}</span>
            <span class="search-result-meta">Category</span>
          </div>
        </a>
      `;
    }

    return `
      <a class="search-result" href="${item.path}">
        <div class="search-result-content">
        <span class="search-result-title">${item.title}</span>
          <span class="search-result-meta">
            ${item.category || ''}${item.author ? ` • ${item.author}` : ''}
          </span>
        </div>
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
    renderResults(results, items, query, taxonomy);
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
    if (!el.contains(e.target)) {
      results.hidden = true;
    }
  });

  wrapper.append(input, btn);
  el.append(wrapper, results);
}
