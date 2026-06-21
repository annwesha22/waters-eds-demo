/* ============================================================
   Shared helpers
   ============================================================ */
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

/* ============================================================
   AUTHOR variation
   ============================================================ */
async function fetchAuthorsTaxonomy() {
  try {
    const resp = await fetch('/blog/taxonomy.json?sheet=authors');
    if (!resp.ok) return {};
    const json = await resp.json();
    const rows = json.data || (json.authors && json.authors.data) || [];
    const map = {};
    rows.forEach((r) => {
      const name = r.Name || r.name;
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

async function fetchAuthorsFromMetadata() {
  try {
    const resp = await fetch('/blog/metadata.json');
    if (!resp.ok) return [];
    const json = await resp.json();
    const rows = json.data || [];
    const seen = new Map();
    rows
      .filter((r) => r.URL && !r.URL.includes('*'))
      .forEach((row) => {
        const name = (row.author || '').trim();
        if (!name || seen.has(name)) return;
        const image = row['og:image'] || row['og-image'] || row.image || '';
        seen.set(name, {
          name,
          slug: slugify(name),
          image: (image && !image.includes('default-meta-image')) ? image : '',
          bio: row.description || '',
        });
      });
    return [...seen.values()];
  } catch {
    return [];
  }
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

  const [taxonomy, metaAuthors] = await Promise.all([
    fetchAuthorsTaxonomy(),
    fetchAuthorsFromMetadata(),
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

/* ============================================================
   CATEGORY variation
   ============================================================ */
function renderCategoryCard(article) {
  const image = article['og:image'] || article.image || '';
  const date = article['publication-date'] || article.date || article.published;

  return `
    <article class="category-card">
      <a class="category-card-image" href="${article.url}">
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
      <div class="category-card-content">
        <h2 class="category-card-title">
          <a href="${article.url}">${article.title}</a>
        </h2>
        <div class="category-card-meta">
          ${article.author ? `<span>By ${article.author}</span>` : ''}
          ${date ? `<span>${formatDate(date)}</span>` : ''}
        </div>
        <p class="category-card-description">${excerpt(article.description, 220, '...')}</p>
      </div>
    </article>
  `;
}

function getCategorySlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

async function loadArticles(categorySlug) {
  const resp = await fetch('/blog/metadata.json');
  if (!resp.ok) return [];

  const json = await resp.json();
  const rows = json.data || [];

  return rows.filter((row) => {
    const category = row.category || row.Category || '';
    const tags = row.tags || row.Tags || '';
    const categoryValues = `${category},${tags}`.split(',').map((v) => slugify(v));
    return categoryValues.includes(categorySlug);
  });
}

async function renderCategory(block) {
  block.innerHTML = '';

  const categorySlug = getCategorySlug();
  const articles = await loadArticles(categorySlug);

  if (!articles.length) {
    block.innerHTML = '<p class="no-results">No articles found.</p>';
    return;
  }

  articles.sort((a, b) => {
    const da = new Date(a['publication-date'] || a.date || 0);
    const db = new Date(b['publication-date'] || b.date || 0);
    return db - da;
  });

  block.innerHTML = `
    <div class="category-header">
      <h1>${categorySlug.replace(/-/g, ' ')}</h1>
    </div>
    <div class="category-list-wrapper">
      ${articles.map(renderCategoryCard).join('')}
    </div>
  `;
}

/* ============================================================
   TAGS variation
   ============================================================ */
function getTagSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

function getTagsFromArticle(article) {
  // metadata sheet stores tags under "article:tag"; fall back to tags/Tags
  const tags = article['article:tag'] || article.tags || article.Tags || '';
  return tags
    .split(',')
    .map((tag) => tag.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

async function loadTagArticles(tagSlug) {
  const resp = await fetch('/blog/metadata.json');
  if (!resp.ok) return [];

  const json = await resp.json();
  const rows = json.data || [];

  return rows
    .filter((r) => r.URL && !r.URL.includes('*'))
    .filter((article) => {
      const tags = getTagsFromArticle(article).map((tag) => slugify(tag));
      return tags.includes(tagSlug);
    });
}

async function loadAllTags() {
  const resp = await fetch('/blog/metadata.json');
  if (!resp.ok) return [];

  const json = await resp.json();
  const rows = json.data || [];
  const tagMap = new Map();

  rows
    .filter((r) => r.URL && !r.URL.includes('*'))
    .forEach((article) => {
      getTagsFromArticle(article).forEach((tag) => {
        const slug = slugify(tag);
        if (!tagMap.has(slug)) {
          tagMap.set(slug, { name: tag, slug });
        }
      });
    });

  return [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderTagCard(article) {
  const image = article['og:image'] || article.image || '';
  const date = article['publication-date'] || article.date || article.published;

  return `
    <article class="tag-card">
      <a class="tag-card-image" href="${article.url}">
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
      <div class="tag-card-content">
        <h2 class="tag-card-title">
          <a href="${article.url}">${article.title}</a>
        </h2>
        <div class="tag-card-meta">
          ${date ? `<span>${formatDate(date)}</span>` : ''}
          ${article.author ? `<span>By ${article.author}</span>` : ''}
        </div>
        <p class="tag-card-description">${excerpt(article.description, 220, '...')}</p>
      </div>
    </article>
  `;
}

function renderTagsSidebar(tags, currentTag) {
  return `
    <aside class="tags-sidebar">
      <h2>Topics</h2>
      <ul>
        ${tags
          .map(
            (tag) => `
              <li>
                <a
                  href="/blog/tags/${tag.slug}"
                  class="${tag.slug === currentTag ? 'active' : ''}">
                  ${tag.name}
                </a>
              </li>
            `,
          )
          .join('')}
      </ul>
    </aside>
  `;
}

async function renderTags(block) {
  block.innerHTML = '';

  const currentTag = getTagSlug();

  const [articles, tags] = await Promise.all([
    loadTagArticles(currentTag),
    loadAllTags(),
  ]);

  articles.sort((a, b) => {
    const da = new Date(a['publication-date'] || a.date || 0);
    const db = new Date(b['publication-date'] || b.date || 0);
    return db - da;
  });

block.innerHTML = `
  <div class="tags-layout">
    ${renderTagsSidebar(tags, currentTag)}
    <div class="tags-results">
      <div class="tags-header">
        <h1>${currentTag.replace(/-/g, ' ')}</h1>
      </div>
      ${
        articles.length
          ? articles.map(renderTagCard).join('')
          : '<p class="no-results">No articles found.</p>'
      }
    </div>
  </div>
`;

}

/* ============================================================
   Entry point — picks variation from the block's class list
   ============================================================ */
export default async function init(block) {
  if (block.classList.contains('author')) {
    await renderAuthors(block);
  } else if (block.classList.contains('category')) {
    await renderCategory(block);
  } else if (block.classList.contains('tags')) {
    await renderTags(block);
  } else {
    // default fallback
    await renderCategory(block);
  }
}