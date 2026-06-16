export default async function decorate(block) {
  const response = await fetch('/tools/tools-query-index.json');
  const json = await response.json();

  const articles = json.data || [];

  block.innerHTML = `
    <div class="article-grid">
      ${articles.map((article) => `
        <article class="article-card">
          <h3>${article.title}</h3>
          <p>${article.description}</p>
        </article>
      `).join('')}
    </div>
  `;
}