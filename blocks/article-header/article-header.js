  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function slugify(name) {
    return name.toLowerCase().trim().replace(/&/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  }

  function estimateReadingTime() {
    const main = document.querySelector('main');
    if (!main) return 0;
    const words = main.textContent.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  // Build a map of { categoryName(lowercase): slug } from the taxonomy sheet.
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
        // Taxonomy sheet uses "Category" + "Slug" columns
        const name = r.Category || r.Tag || r.Name;
        const slug = r.Slug;
        if (name && slug) map[name.trim().toLowerCase()] = slug;
      });
    } catch { /* ignore */ }
    return map;
  }

  // Fetch the bulk metadata sheet and return the row matching the current page.
  async function fetchBulkMetadata() {
    try {
      const resp = await fetch('/blog/metadata.json');
      if (!resp.ok) return {};
      const json = await resp.json();
      const rows = json.data || [];
      const { pathname } = window.location;

      // Exact URL match first, then wildcard prefix (e.g. /blog/articles/**)
      const exact = rows.find((r) => r.URL && r.URL === pathname);
      if (exact) return exact;

      const wildcard = rows.find((r) => {
        if (!r.URL || !r.URL.includes('*')) return false;
        const prefix = r.URL.replace(/\*+$/, '');
        return pathname.startsWith(prefix);
      });
      return wildcard || {};
    } catch {
      return {};
    }
  }

  export default async function init(el) {
    const [meta, taxonomy] = await Promise.all([
      fetchBulkMetadata(),
      fetchTaxonomy(),
    ]);

    const title = meta.title || document.title;
    const date = meta['publication-date'] || '';
    const author = meta.author || '';
    const image = meta['og:image'] || '';
    const category = meta.category || '';

    const readTime = estimateReadingTime();
    const authorSlug = author ? author.toLowerCase().replace(/\s+/g, '-') : '';
    const firstCategory = category ? category.split(',')[0].trim().replace(/^"|"$/g, '') : '';

    const categorySlug = firstCategory
      ? (taxonomy[firstCategory.toLowerCase()] || slugify(firstCategory))
      : '';

    el.innerHTML = `
      <div class="article-header-content">
        <h1 class="article-header-title">${title}</h1>
        <hr class="article-header-separator" />
        <div class="article-header-meta">
          ${date ? `<span class="article-header-date">${formatDate(date)}</span>` : ''}
          ${author ? `<span class="article-header-divider">|</span><span class="article-header-author">By <a href="/blog/author/${authorSlug}">${author}</a></span>` : ''}
          ${firstCategory ? `<span class="article-header-divider">|</span><a href="/blog/categories/${categorySlug}" class="article-header-tag">${firstCategory}</a>` : ''}
        </div>
        ${readTime ? `<div class="article-header-reading-time">Reading Time: ${readTime} minutes</div>` : ''}
      </div>
    ${(image && !image.includes('default-meta-image')) ? `<div class="article-header-image"><img src="${image.split('?')[0]}?width=750&format=webply&optimize=medium" alt="${title}" width="750" height="500" /></div>` : ''}
    `;
  }
