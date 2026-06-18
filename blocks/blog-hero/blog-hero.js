function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [String(raw)];
  try { return JSON.parse(raw); } catch { /* not JSON */ }
  return raw.replace(/^"|"$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
}

function formatDate(value) {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/&/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

async function fetchTaxonomy() {
  const map = {};
  try {
    const resp = await fetch('/blog/taxonomy.json');
    if (!resp.ok) return map;
    const json = await resp.json();

    const sheetNames = json[':names'] || Object.keys(json).filter((k) => json[k] && json[k].data);
    const allRows = [];
    if (sheetNames.length) {
      sheetNames.forEach((s) => { if (json[s] && json[s].data) allRows.push(...json[s].data); });
    } else if (json.data) {
      allRows.push(...json.data);
    }

    allRows.forEach((r) => {
      const name = r.Tag || r.Name || r.Category;
      const slug = r.Slug;
      if (name && slug) map[name.trim().toLowerCase()] = slug;
    });
  } catch { /* ignore */ }
  return map;
}

async function fetchFeaturedPosts() {
  try {
    const resp = await fetch('/blog/metadata.json');
    if (!resp.ok) return [];
    const json = await resp.json();
    const rows = json.data || [];
    return rows
      .filter((r) => r.URL && !r.URL.includes('*'))
      .filter((r) => String(r.featured).toLowerCase() === 'true')
      .map((r) => ({
        path: r.URL,
        title: r.title || '',
        description: r.description || '',
        author: r.author || '',
        date: r['publication-date'] || '',
        category: r.category || '',
        image: r['og:image'] || r['og-image'] || r.image || '',
      }));
  } catch {
    return [];
  }
}

export default async function init(el) {
  el.innerHTML = '';

  let post = null;
  try {
    const posts = await fetchFeaturedPosts();
    posts.sort((a, b) => (new Date(b.date) - new Date(a.date)));
    [post] = posts;
  } catch (e) {
    return;
  }

  if (!post) return;

  const date = formatDate(post.date);
  const authorSlug = post.author ? post.author.toLowerCase().replace(/\s+/g, '-') : '';
  const firstCategory = post.category
    ? post.category.split(',')[0].trim().replace(/^"|"$/g, '')
    : '';

  el.innerHTML = `
    <div class="blog-hero-content">
      <h2 class="blog-hero-title">
        <a href="${post.path}">${post.title}</a>
      </h2>
      <hr class="blog-hero-separator" />
      <div class="blog-hero-meta">
        <span class="blog-hero-date">${date}</span>
        ${post.author ? `<span class="blog-hero-divider">|</span><span class="blog-hero-author">By <a href="/author/${authorSlug}">${post.author}</a></span>` : ''}
        ${firstCategory ? `<span class="blog-hero-divider">|</span><a href="/blog/?category=${encodeURIComponent(firstCategory)}" class="blog-hero-tag">${firstCategory}</a>` : ''}
      </div>
      ${post.description ? `<p class="blog-hero-excerpt">${post.description}</p>` : ''}
      <p class="blog-hero-cta"><a href="${post.path}">Read More</a></p>
    </div>
    <div class="blog-hero-image">
      ${(post.image && !post.image.includes('default-meta-image')) ? `<img src="${post.image.split('?')[0]}?width=750&format=webply&optimize=medium" alt="${post.title}" loading="eager" />` : ''}
    </div>
  `;
}
