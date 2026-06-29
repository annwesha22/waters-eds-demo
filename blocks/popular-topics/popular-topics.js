async function fetchJson(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return await resp.json();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return null;
  }
}

function normalizeTag(tag) {
  return tag?.trim().toLowerCase();
}

function buildTagCounts(articles) {
  const counts = {};

  articles.forEach((article) => {
    const articleTags = article['article-tags'];

    if (!articleTags) {
      return;
    }

    articleTags
      .split(',')
      .map(normalizeTag)
      .filter(Boolean)
      .forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
  });

  return counts;
}

// Read all tags from the "tags" sheet in /blog/taxonomy.json
function buildTagsFromTaxonomy(taxonomyData) {
  const rows = taxonomyData?.data
    || (taxonomyData?.tags && taxonomyData.tags.data)
    || [];

  return rows
    .map((row) => {
      const name = row.Tag || row.Name || row.name || row.Value || row.value;
      const slug = row.Slug || row.slug || row.Key || row.key || name;

      return { name, slug };
    })
    .filter((tag) => tag.name && tag.slug);
}

export default async function decorate(block) {
  const [articlesJson, taxonomyJson] = await Promise.all([
    fetchJson('/tools/tools-query-index.json'),
    fetchJson('/blog/taxonomy.json?sheet=tags'),
  ]);

  const articles = articlesJson?.data || articlesJson || [];
  const tagCounts = buildTagCounts(articles);
  const tags = buildTagsFromTaxonomy(taxonomyJson);

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'popular-topics-inner';

  const heading = document.createElement('h2');
  heading.className = 'popular-topics-title';
  heading.textContent = 'Popular Topics';

  const underline = document.createElement('div');
  underline.className = 'popular-topics-underline';

  const topicsContainer = document.createElement('div');
  topicsContainer.className = 'popular-topics-links';

  tags.forEach(({ name, slug }) => {
    const key = normalizeTag(slug);
    const count = tagCounts[key] || 0;

    const link = document.createElement('a');
    link.className = 'popular-topics-link';
    link.href = `/blog/tags/${slug}`;

    link.textContent = count > 0
      ? `${name} (${count})`
      : name;

    topicsContainer.append(link);
  });

  wrapper.append(
    heading,
    underline,
    topicsContainer,
  );

  block.append(wrapper);
}
