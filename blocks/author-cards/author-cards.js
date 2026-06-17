const slugify = (name) => (name || '').toLowerCase().replace(/&/g, 'and')
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

// Trim a bio to ~160 chars with an ellipsis, matching the source excerpt style
function excerpt(text, len = 160) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > len ? `${clean.slice(0, len).trim()}…` : clean;
}

// Authors taxonomy sheet → map keyed by slug: { name, image, bio, slug }
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

// Unique authors pulled from the bulk metadata sheet (/blog/metadata.json)
async function fetchAuthorsFromMetadata() {
  try {
    const resp = await fetch('/blog/metadata.json');
    if (!resp.ok) return [];
    const json = await resp.json();
    const rows = json.data || [];
    const seen = new Map();
    rows
      // Real article rows only — skip wildcard/template rows (e.g. /blog/articles/**)
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

function renderCard(a) {
  const href = `/blog/author/${a.slug}`;
  const img = a.image
    ? `<img src="${a.image.split('?')[0]}?width=350&format=webply&optimize=medium" alt="${a.name}" width="350" height="350" loading="lazy">`
    : '';
  return `
    <div class="author-item">
      <div class="author-pic">${img}</div>
      <div class="author-info">
        <h2><a href="${href}">${a.name}</a></h2>
        ${a.bio ? `<p>${excerpt(a.bio)}</p>` : ''}
        <a class="archive-link" href="${href}">Full Bio & Author’s Posts</a>
      </div>
    </div>`;
}

export default async function init(el) {
  el.innerHTML = '';

  const [taxonomy, metaAuthors] = await Promise.all([
    fetchAuthorsTaxonomy(),
    fetchAuthorsFromMetadata(),
  ]);

  // Merge: metadata authors decide WHO is shown; taxonomy enriches
  // (full bio + curated image) when the slug matches an authors-sheet entry.
  const merged = metaAuthors.map((m) => {
    const t = taxonomy[m.slug];
    return t
      ? { name: t.name || m.name, slug: m.slug, image: t.image || m.image, bio: t.bio || m.bio }
      : m;
  });

  if (!merged.length) return;

  merged.sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = `<div class="author-wrapper">${merged.map(renderCard).join('')}</div>`;
}