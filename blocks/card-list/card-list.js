const slugify = (value) => (value || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

function excerpt(text, len = 220, ellipsis = '...') {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > len ? `${clean.slice(0, len).trim()}${ellipsis}` : clean;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function readingTime(article) {
  const explicit = parseInt(article['reading-time'] || article.readingTime || '', 10);
  if (!Number.isNaN(explicit) && explicit > 0) return explicit;
  const text = `${article.title || ''} ${article.description || ''}`;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function authorSlugOf(name, authorMap) {
  if (!name) return '';
  return authorMap[name.trim().toLowerCase()] || slugify(name);
}

function renderMeta(article, authorMap) {
  const author = (article.author || '').trim();
  const authorSlug = authorSlugOf(author, authorMap);
  const date = article['publication-date'] || article.date || article.published;
  const mins = readingTime(article);

  const parts = [];
  if (author) {
    parts.push(`<span class="posted-by">By <a href="/blog/author/${authorSlug}"><span class="meta-label">${author}</span></a></span>`);
  }
  if (date) {
    parts.push(`<span class="posted-on"><time class="entry-date published">${formatDate(date)}</time></span>`);
  }
  parts.push(`<span class="kt-reading-time-wrap"><span class="kt-reading-time"><span class="kt-reading-time-label">Reading Time:</span> ${mins} <span class="kt-reading-time-postfix">minutes</span></span></span>`);

  return `<div class="entry-meta entry-meta-divider-vline">${parts.join('')}</div>`;
}

function getCurrentSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

async function fetchMetadataRows() {
  try {
    const resp = await fetch('/blog/metadata.json');
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.data || []).filter((r) => r.URL && !r.URL.includes('*'));
  } catch {
    return [];
  }
}

async function fetchTaxonomy() {
  const categoryMap = {};
  const authorMap = {};
  try {
    const resp = await fetch('/blog/taxonomy.json');
    if (!resp.ok) return { categoryMap, authorMap };
    const json = await resp.json();

    const sheetNames = json[':names'] || Object.keys(json).filter((k) => json[k] && json[k].data);
    const allRows = [];
    if (sheetNames.length) {
      sheetNames.forEach((s) => { if (json[s] && json[s].data) allRows.push(...json[s].data); });
    } else if (json.data) {
      allRows.push(...json.data);
    }

    allRows.forEach((r) => {
      const slug = r.Slug;
      if (!slug) return;
      if (r.Author) authorMap[r.Author.trim().toLowerCase()] = slug;
      const category = r.Category || r.Tag || r.Name;
      if (category) categoryMap[category.trim().toLowerCase()] = slug;
    });
  } catch { /* ignore */ }
  return { categoryMap, authorMap };
}

function getCategoriesFromArticle(article) {
  const category = article.category || article.Category || '';
  return category
    .split(',')
    .map((c) => c.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function getTagsFromArticle(article) {
  const tags = article['article:tag'] || article.tags || article.Tags || '';
  return tags
    .split(',')
    .map((tag) => tag.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

async function fetchAuthorsTaxonomy() {
  try {
    const resp = await fetch('/blog/taxonomy.json?sheet=authors');
    if (!resp.ok) return {};
    const json = await resp.json();
    const rows = json.data || (json.authors && json.authors.data) || [];
    const map = {};
    rows.forEach((r) => {
      const name = r.Author || r.Name || r.name;
      const slug = r.Slug || r.slug || slugify(name);
      if (!name) return;
      map[slug] = {
        name,
        slug,
        image: r.Image || r.image || '',
        bio: r.Bio || r.bio || r.Description || r.description || '',
      };
    });
    return map;
  } catch {
    return {};
  }
}

async function fetchAuthorsFromMetadata(authorMap) {
  const rows = await fetchMetadataRows();
  const seen = new Map();
  rows.forEach((row) => {
    const name = (row.author || '').trim();
    if (!name || seen.has(name)) return;
    const image = row['og:image'] || row['og-image'] || row.image || '';
    seen.set(name, {
      name,
      slug: authorSlugOf(name, authorMap),
      image: (image && !image.includes('default-meta-image')) ? image : '',
      bio: row.description || '',
    });
  });
  return [...seen.values()];
}

function renderAuthorCard(a) {
  const href = `/blog/author/${a.slug}`;
  const img = a.image
    ? `<img src="${a.image.split('?')[0]}?width=350&format=webply&optimize=medium" alt="${a.name}" width="350" height="350" loading="lazy">`
    : '';
  return `
    <div class="author-item">
      <div class="author-pic">${img}</div>
      <div class="author-info">
        <h2><a href="${href}">${a.name}</a></h2>
        ${a.bio ? `<p>${excerpt(a.bio, 160, '…')}</p>` : ''}
        <a class="archive-link" href="${href}">Full Bio & Author’s Posts</a>
      </div>
    </div>`;
}

async function renderAuthors(el) {
  el.innerHTML = '';

  const { authorMap } = await fetchTaxonomy();
  const [taxonomy, metaAuthors] = await Promise.all([
    fetchAuthorsTaxonomy(),
    fetchAuthorsFromMetadata(authorMap),
  ]);

  const merged = metaAuthors.map((m) => {
    const t = taxonomy[m.slug];
    return t
      ? { name: t.name || m.name, slug: m.slug, image: t.image || m.image, bio: t.bio || m.bio }
      : m;
  });

  if (!merged.length) return;

  merged.sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = `<div class="author-wrapper">${merged.map(renderAuthorCard).join('')}</div>`;
}

function renderArchiveCard(article, authorMap) {
  const image = article['og:image'] || article.image || '';
  const url = article.URL || article.url || '';

  return `
    <article class="archive-card">
      <div class="archive-card-image">
        <a href="${url}">
          ${
            image
              ? `<img
                  src="${image}"
                  alt="${article.title}"
                  width="750"
                  height="500"
                  loading="lazy">`
              : ''
          }
        </a>
      </div>
      <div class="archive-card-content">
        <h2 class="archive-card-title">
          <a href="${url}">${article.title}</a>
        </h2>
        ${renderMeta(article, authorMap)}
        <p class="archive-card-description">${excerpt(article.description, 220)}</p>
      </div>
    </article>
  `;
}

function collectCategories(rows) {
  const map = new Map();
  rows.forEach((r) => {
    getCategoriesFromArticle(r).forEach((name) => {
      const slug = slugify(name);
      if (!map.has(slug)) map.set(slug, { name, slug });
    });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function collectTags(rows) {
  const map = new Map();
  rows.forEach((r) => {
    getTagsFromArticle(r).forEach((name) => {
      const slug = slugify(name);
      if (!map.has(slug)) map.set(slug, { name, slug });
    });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderSidebar(categories, topics, currentSlug) {
  return `
    <aside class="archive-sidebar">
      <div class="sidebar-section">
        <h2>Categories</h2>
        <ul class="sidebar-links">
          ${categories
            .map(
              (c) => `<li><a href="/blog/categories/${c.slug}" class="${c.slug === currentSlug ? 'active' : ''}">${c.name}</a></li>`,
            )
            .join('')}
        </ul>
      </div>
      <div class="sidebar-section">
        <h2>Popular Topics</h2>
        <div class="topic-links">
          ${topics
            .map(
              (t) => `<a href="/blog/tags/${t.slug}" class="${t.slug === currentSlug ? 'active' : ''}">${t.name}</a>`,
            )
            .join('')}
        </div>
      </div>
    </aside>
  `;
}

function filterArticles(rows, type, currentSlug) {
  return rows.filter((article) => {
    if (type === 'tags') {
      return getTagsFromArticle(article).map((t) => slugify(t)).includes(currentSlug);
    }
    const values = [
      ...getCategoriesFromArticle(article),
      ...getTagsFromArticle(article),
    ].map((v) => slugify(v));
    return values.includes(currentSlug);
  });
}

async function renderArchive(block, type) {
  block.innerHTML = '';

  const currentSlug = getCurrentSlug();
  const [rows, { authorMap }] = await Promise.all([
    fetchMetadataRows(),
    fetchTaxonomy(),
  ]);

  const categories = collectCategories(rows);
  const topics = collectTags(rows);
  const articles = filterArticles(rows, type, currentSlug);

  articles.sort((a, b) => {
    const da = new Date(a['publication-date'] || a.date || 0);
    const db = new Date(b['publication-date'] || b.date || 0);
    return db - da;
  });

  block.innerHTML = `
    <div class="archive-layout">
      <div class="archive-results">
        <div class="archive-header">
          <h1>${currentSlug.replace(/-/g, ' ')}</h1>
        </div>
        ${
          articles.length
            ? articles.map((a) => renderArchiveCard(a, authorMap)).join('')
            : '<p class="no-results">No articles found.</p>'
        }
      </div>
      ${renderSidebar(categories, topics, currentSlug)}
    </div>
  `;
}

export default async function init(block) {
  if (block.classList.contains('author')) {
    await renderAuthors(block);
  } else if (block.classList.contains('tags')) {
    await renderArchive(block, 'tags');
  } else if (block.classList.contains('category')) {
    await renderArchive(block, 'category');
  } else {
    await renderArchive(block, 'category');
  }
}