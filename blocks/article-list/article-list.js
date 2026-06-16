export default async function decorate(block) {
  const response = await fetch('/tools/tools-query-index.json');
  const json = await response.json();

  const articles = json.data || [];

  block.innerHTML = `
    <div class="article-grid">
      ${articles.map((article) => `
        <a class="article-card" href="${article.path}">
          <img
            src="${article.image}"
            alt="${article.title}"
            loading="lazy"
          >

          <div class="article-card-content">

            <h3>${article.title}</h3>

            <div class="article-meta">
              <span>${formatDate(article['publication-date'])}</span>
              <span>|</span>
              <span>${article.author}</span>
            </div>

            <div class="article-reading-time">
              Reading Time: ${article['reading-time']} minutes
            </div>

            <p class="article-description">
              ${article.description}
            </p>

          </div>
        </a>
      `).join('')}
    </div>
  `;
}

function formatDate(dateString) {
  const date = new Date(dateString);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}