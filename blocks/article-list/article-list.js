function formatDate(dateString) {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTag(tag) {
  return tag
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slugifyAuthor(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Fetch the Author -> Slug mapping from /blog/taxonomy.json (authors sheet)
async function fetchAuthorSlugMap() {
  const map = {};

  try {
    const resp = await fetch("/blog/taxonomy.json?sheet=authors");

    if (!resp.ok) {
      return map;
    }

    const json = await resp.json();
    const rows = json.data || (json.authors && json.authors.data) || [];

    rows.forEach((row) => {
      const name = row.Author || row.Name || row.name;
      const slug = row.Slug || row.slug;

      if (name) {
        map[name.trim().toLowerCase()] = slug || slugifyAuthor(name);
      }
    });
  } catch {
    // ignore — fall back to slugifying the name
  }

  return map;
}

// Build the author page path, using the taxonomy slug when available
function getAuthorPath(name, authorMap) {
  if (!name) {
    return "";
  }

  const slug = authorMap[name.trim().toLowerCase()] || slugifyAuthor(name);

  return `/blog/author/${slug}`;
}

// Render the author meta. Uses a real <a> so hovering shows the URL.
function renderAuthorMeta(author, authorMap) {
  if (!author) {
    return "";
  }

  const href = getAuthorPath(author, authorMap);

  return `
    <a
      class="article-author-link"
      href="${href}"
    >By ${author}</a>
  `;
}

export default async function decorate(block) {
  // eslint-disable-next-line no-console
  console.log(block.className);

  const isTagPage = block.classList.contains("tagpage");
  // eslint-disable-next-line no-console
  console.log("Current URL:", window.location.pathname);

  // eslint-disable-next-line no-console
  console.log(`Article List Variant: ${isTagPage ? "tagpage" : "default"}`);

  try {
    const [response, authorMap] = await Promise.all([
      fetch("/tools/tools-query-index.json"),
      fetchAuthorSlugMap(),
    ]);

    if (!response.ok) {
      throw new Error(`Failed to load index: ${response.status}`);
    }

    const json = await response.json();
    const articles = json.data || [];

    let currentTagFromUrl = "";
    let filteredArticles = articles;

    if (isTagPage) {
      const pathSegments = window.location.pathname.split("/").filter(Boolean);

      currentTagFromUrl = pathSegments[pathSegments.length - 1];

      filteredArticles = articles.filter((article) => {
        if (!article.tags) {
          return false;
        }

        const tags = article.tags
          .split(",")
          .map((tag) => tag.trim().toLowerCase());

        return tags.includes(currentTagFromUrl.toLowerCase());
      });

      // eslint-disable-next-line no-console
      console.log(
        `Found ${filteredArticles.length} articles for tag ${currentTagFromUrl}`,
      );
    }

    const PAGE_SIZE = 6;
    let currentPage = 1;
    let activeTag = "all";

    const uniqueTags = new Set();

    articles.forEach((article) => {
      if (!article.tags) return;

      article.tags
        .split(",")
        .map((tag) => tag.trim())
        .forEach((tag) => uniqueTags.add(tag));
    });

    if (isTagPage) {
      block.innerHTML = `
        <div class="tagpage-layout">

          <div class="tagpage-content">

            <div class="article-grid tagpage-grid">
              ${filteredArticles
                .map(
                  (article) => `
                    <div
                      class="article-card tagpage-card"
                      data-href="${article.path}"
                      data-tags="${article.tags || ""}"
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
                            article["publication-date"],
                          )}</span>
                          <span>|</span>
                          ${renderAuthorMeta(article.author, authorMap)}
                        </div>

                        <div class="article-reading-time">
                          Reading Time:
                          ${article["reading-time"]} minutes
                        </div>

                        <p class="article-description">
                          ${article.description}
                        </p>

                      </div>
                    </div>
                  `,
                )
                .join("")}
            </div>

            <div class="article-pagination"></div>

          </div>

          <aside class="tagpage-sidebar">

            <div class="sidebar-section">
              <h3>Categories</h3>

              <ul>
                <li>Clinical</li>
                <li>ESG</li>
                <li>Featured</li>
                <li>Food & Environmental</li>
                <li>Materials Science</li>
                <li>Pharmaceutical</li>
                <li>Technology</li>
              </ul>
            </div>

            <div class="sidebar-section">
              <h3>Popular Topics</h3>

              <ul>
                <li>ACQUITY QDa</li>
                <li>Bioanalysis</li>
                <li>Biopharma</li>
                <li>HPLC</li>
                <li>LC-MS</li>
                <li>Mass Spectrometry</li>
              </ul>
            </div>

          </aside>

        </div>
      `;
    } else {
      block.innerHTML = `
        <p class="article-list-label">Recent Post</p>

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
            .join("")}

          <a
            href="#"
            class="article-reset-link"
          >
            Reset
          </a>
        </div>

        <div class="article-grid">
          ${articles
            .map(
              (article) => `
                <div
                  class="article-card"
                  data-href="${article.path}"
                  data-tags="${article.tags || ""}"
                >
                  <img
                    src="${article.image}"
                    alt="${article.title}"
                    loading="lazy"
                  >

                  <div class="article-card-content">

                    <h3>${article.title}</h3>

                    <div class="article-meta">
                      <span>${formatDate(article["publication-date"])}</span>
                      <span>|</span>
                      ${renderAuthorMeta(article.author, authorMap)}
                    </div>

                    <div class="article-reading-time">
                      Reading Time:
                      ${article["reading-time"]} minutes
                    </div>

                    <p class="article-description">
                      ${article.description}
                    </p>

                  </div>
                </div>
              `,
            )
            .join("")}
        </div>

        <div class="article-pagination"></div>
      `;
    }

    const buttons = block.querySelectorAll(".filter-btn");
    const cards = block.querySelectorAll(".article-card");
    const paginationContainer = block.querySelector(".article-pagination");

    // Card click -> navigate to the article, unless an inner link was clicked.
    cards.forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
          return; // let real links (e.g. author) handle their own navigation
        }

        const href = card.dataset.href;

        if (href) {
          window.location.href = href;
        }
      });
    });

    // Stop author link clicks from bubbling up to the card handler.
    block.querySelectorAll(".article-author-link").forEach((authorLink) => {
      authorLink.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    });

    function renderPagination(totalPages) {
      paginationContainer.innerHTML = "";

      if (totalPages <= 1) {
        return;
      }

      for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement("button");

        button.textContent = page;

        button.className =
          page === currentPage ? "page-btn active" : "page-btn";

        button.addEventListener("click", () => {
          currentPage = page;
          updateVisibility();

          window.scrollTo({
            top: block.offsetTop - 50,
            behavior: "smooth",
          });
        });

        paginationContainer.appendChild(button);
      }
    }

    function updateVisibility() {
      const matchingCards = [];

      cards.forEach((card) => {
        const tags = card.dataset.tags.split(",").map((tag) => tag.trim());

        const matchesTag = isTagPage
          ? true
          : activeTag === "all" || tags.includes(activeTag);

        if (matchesTag) {
          matchingCards.push(card);
        }
      });

      cards.forEach((card) => {
        card.style.display = "none";
      });

      const start = (currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;

      matchingCards.slice(start, end).forEach((card) => {
        card.style.display = "";
      });

      const totalPages = Math.ceil(matchingCards.length / PAGE_SIZE);

      renderPagination(totalPages);
    }

    if (!isTagPage) {
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          buttons.forEach((btn) => {
            btn.classList.remove("active");
          });

          button.classList.add("active");

          activeTag = button.dataset.tag;
          currentPage = 1;

          updateVisibility();
        });
      });

      const resetLink = block.querySelector(".article-reset-link");

      if (resetLink) {
        resetLink.addEventListener("click", (event) => {
          event.preventDefault();

          buttons.forEach((btn) => {
            btn.classList.remove("active");
          });

          const allButton = block.querySelector('.filter-btn[data-tag="all"]');

          if (allButton) {
            allButton.classList.add("active");
          }

          activeTag = "all";
          currentPage = 1;

          updateVisibility();
        });
      }
    }

    updateVisibility();
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
