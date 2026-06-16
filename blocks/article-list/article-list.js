export default async function decorate(block) {
  const resp = await fetch('/query-index.json');

  if (!resp.ok) {
    block.textContent = 'Unable to load articles';
    return;
  }

  const json = await resp.json();
  const articles = json.data || [];

  block.innerHTML = `
    <div class="article-list-search">
      <input
        type="search"
        placeholder="Search articles..."
      />
    </div>

    <div class="article-filters"></div>

    <div class="article-grid"></div>
  `;

  const grid = block.querySelector('.article-grid');

  grid.innerHTML = articles.map((article) => `
    <a class="article-card" href="${article.path}">
      <img src="${article.image}" alt="${article.title}">
      <h3>${article.title}</h3>

      <div class="article-meta">
        ${article['publication-date']} | ${article.author}
      </div>

      <div class="article-reading-time">
        Reading Time: ${article['reading-time']} minutes
      </div>

      <p>${article.description}</p>
    </a>
  `).join('');
}