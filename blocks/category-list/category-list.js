function slugify(value) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDate(dateString) {
  if (!dateString) return '';

  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function excerpt(text, len = 220) {
  if (!text) return '';

  const clean = text.replace(/\s+/g, ' ').trim();

  return clean.length > len
    ? `${clean.slice(0, len).trim()}...`
    : clean;
}

function renderCard(article) {
  const image =
    article['og:image']
    || article.image
    || '';

  const date =
    article['publication-date']
    || article.date
    || article.published;

  return `
    <article class="category-card">
      <a class="category-card-image" href="${article.url}">
        ${
          image
            ? `<img
                src="${image}"
                alt="${article.title}"
                loading="lazy">`
            : ''
        }
      </a>

      <div class="category-card-content">

        <h2 class="category-card-title">
          <a href="${article.url}">
            ${article.title}
          </a>
        </h2>

        <div class="category-card-meta">
          ${
            article.author
              ? `<span>By ${article.author}</span>`
              : ''
          }

          ${
            date
              ? `<span>${formatDate(date)}</span>`
              : ''
          }
        </div>

        <p class="category-card-description">
          ${excerpt(article.description)}
        </p>
      </div>
    </article>
  `;
}

async function getCategorySlug() {
  const parts = window.location.pathname
    .split('/')
    .filter(Boolean);

  return parts[parts.length - 1];
}

async function loadArticles(categorySlug) {
  const resp = await fetch('/blog/metadata.json');

  if (!resp.ok) {
    return [];
  }

  const json = await resp.json();
  const rows = json.data || [];

  return rows.filter((row) => {
    const category =
      row.category
      || row.Category
      || '';

    const tags =
      row.tags
      || row.Tags
      || '';

    const categoryValues = `${category},${tags}`
      .split(',')
      .map((v) => slugify(v));

    return categoryValues.includes(categorySlug);
  });
}

export default async function init(block) {
  block.innerHTML = '';

  const categorySlug = await getCategorySlug();

  const articles = await loadArticles(categorySlug);

  if (!articles.length) {
    block.innerHTML = `
      <p class="no-results">
        No articles found.
      </p>
    `;
    return;
  }

  articles.sort((a, b) => {
    const da = new Date(
      a['publication-date'] || a.date || 0,
    );

    const db = new Date(
      b['publication-date'] || b.date || 0,
    );

    return db - da;
  });

  block.innerHTML = `

    <div class="category-list-wrapper">
      ${articles.map(renderCard).join('')}
    </div>
  `;
}