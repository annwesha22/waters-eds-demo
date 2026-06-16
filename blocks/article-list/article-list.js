function formatDate(dateString) {
  const date = new Date(dateString);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTag(tag) {
  return tag
    .split('-')
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

export default async function decorate(block) {
  try {
    const response = await fetch('/tools/tools-query-index.json');

    if (!response.ok) {
      throw new Error(`Failed to load index: ${response.status}`);
    }

    const json = await response.json();
    const articles = json.data || [];

    const uniqueTags = new Set();

    articles.forEach((article) => {
      if (!article.tags) return;

      article.tags
        .split(',')
        .map((tag) => tag.trim())
        .forEach((tag) => uniqueTags.add(tag));
    });

    block.innerHTML = `
      <div class="article-filters">
        <button
          class="filter-btn active"
          data-tag="all"
        >
          All
        </button>

        ${[...uniqueTags]
          .sort()
          .map(
            (tag) => `
              <button
                class="filter-btn"
                data-tag="${tag}"
              >
                ${formatTag(tag)}
              </button>
            `,
          )
          .join('')}
      </div>

      <div class="article-grid">
        ${articles
          .map(
            (article) => `
              <a
                class="article-card"
                href="${article.path}"
                data-tags="${article.tags || ''}"
              >
                <img
                  src="${article.image}"
                  alt="${article.title}"
                  loading="lazy"
                >

                <div class="article-card-content">

                  <h3>${article.title}</h3>

                  <div class="article-meta">
                    <span>${formatDate(
                      article['publication-date'],
                    )}</span>
                    <span>|</span>
                    <span>${article.author}</span>
                  </div>

                  <div class="article-reading-time">
                    Reading Time:
                    ${article['reading-time']} minutes
                  </div>

                  <p class="article-description">
                    ${article.description}
                  </p>

                </div>
              </a>
            `,
          )
          .join('')}
      </div>
    `;

    const buttons = block.querySelectorAll('.filter-btn');
    const cards = block.querySelectorAll('.article-card');

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((btn) => {
          btn.classList.remove('active');
        });

        button.classList.add('active');

        const selectedTag = button.dataset.tag;

        cards.forEach((card) => {
          if (selectedTag === 'all') {
            card.style.display = '';
            return;
          }

          const tags = card.dataset.tags
            .split(',')
            .map((tag) => tag.trim());

          card.style.display = tags.includes(selectedTag)
            ? ''
            : 'none';
        });
      });
    });
  } catch (error) {
    block.innerHTML = `
      <div class="article-list-error">
        Unable to load articles.
      </div>
    `;

    // eslint-disable-next-line no-console
    console.error(error);
  }
}