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
    if (!article.tags) {
      return;
    }

    article.tags
      .split(',')
      .map(normalizeTag)
      .filter(Boolean)
      .forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
  });

  return counts;
}

function buildTagMap(taggingData) {
  const tagMap = {};

  const rows = taggingData?.data || taggingData || [];

  rows.forEach((row) => {
    const key = normalizeTag(row.key);
    const value = row.value?.trim();

    if (key && value) {
      tagMap[key] = value;
    }
  });

  return tagMap;
}

export default async function decorate(block) {
  const authoredTags = [...block.children]
    .map((row) => row.textContent.trim())
    .filter(Boolean)
    .map(normalizeTag);

  const [articlesJson, taggingJson] = await Promise.all([
    fetchJson('/tools/tools-query-index.json'),
    fetchJson('/docs/library/tagging.json'),
  ]);

  const articles = articlesJson?.data || articlesJson || [];
  const tagCounts = buildTagCounts(articles);
  const tagMap = buildTagMap(taggingJson);

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'popular-topics-wrapper';

  const heading = document.createElement('h2');
  heading.className = 'popular-topics-title';
  heading.textContent = 'Popular Topics';

  const underline = document.createElement('div');
  underline.className = 'popular-topics-underline';

  const topicsContainer = document.createElement('div');
  topicsContainer.className = 'popular-topics-links';

  authoredTags.forEach((tagKey) => {
    const displayName = tagMap[tagKey] || tagKey;
    const count = tagCounts[tagKey] || 0;

    const link = document.createElement('a');
    link.className = 'popular-topics-link';
    link.href = `/blog/tags/${tagKey}`;

    link.textContent = count > 0
      ? `${displayName} (${count})`
      : displayName;

    topicsContainer.append(link);
  });

  wrapper.append(
    heading,
    underline,
    topicsContainer,
  );

  block.append(wrapper);
}