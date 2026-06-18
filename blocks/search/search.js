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
        image: r['og:image'] || r['og-image'] || r.image || '',
      }));
  } catch {
    return [];
  }
}

function matchesQuery(item, query) {
  const haystack = [
    item.title,
    item.description,
    item.author,
    item.category,
  ].join(' ').toLowerCase();
  return haystack.includes(query);
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

  resultsEl.innerHTML = matches.map((item) => `
    <a class="search-result" href="${item.path}">
      <span class="search-result-title">${item.title}</span>
      ${item.category ? `<span class="search-result-category">${item.category.split(',')[0].trim().replace(/^"|"$/g, '')}</span>` : ''}
    </a>
  `).join('');
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

  // Lazy-load the metadata once, on first interaction
  let dataPromise = null;
  const ensureData = () => {
    if (!dataPromise) dataPromise = fetchSearchData();
    return dataPromise;
  };

  const runSearch = async () => {
    const query = input.value.trim().toLowerCase();
    const items = await ensureData();
    renderResults(results, items, query);
  };

  input.addEventListener('focus', ensureData);
  input.addEventListener('input', runSearch);

  btn.addEventListener('click', () => {
    const query = input.value.trim();
    if (query) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
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
