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

  async function fetchTaxonomy() {
    const categoryMap = {};
    const authorMap = {};
    try {
      const resp = await fetch('/blog/taxonomy.json');
      if (!resp.ok) return { categoryMap, authorMap };
      const json = await resp.json();

      const sheetNames = json[':names'] || Object.keys(json).filter((k) => json[k] && json[k].data);
      const allRows = [];
      if (sheetNames.length) {
        sheetNames.forEach((s) => { if (json[s] && json[s].data) allRows.push(...json[s].data); });
      } else if (json.data) {
        allRows.push(...json.data);
      }

      allRows.forEach((r) => {
        const slug = r.Slug;
        if (!slug) return;

        const author = r.Author;
        if (author) authorMap[author.trim().toLowerCase()] = slug;

        const category = r.Category || r.Tag || r.Name;
        if (category) categoryMap[category.trim().toLowerCase()] = slug;
      });
    } catch { /* ignore */ }
    return { categoryMap, authorMap };
  }

  async function fetchBulkMetadata() {
    try {
      const resp = await fetch('/blog/metadata.json');
      if (!resp.ok) return {};
      const json = await resp.json();
      const rows = json.data || [];
      const { pathname } = window.location;

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

  function getImageSize(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  export default async function init(el) {
    const [meta, { categoryMap, authorMap }] = await Promise.all([
      fetchBulkMetadata(),
      fetchTaxonomy(),
    ]);

    const title = meta.title || document.title;
    const date = meta['publication-date'] || '';
    const author = meta.author || '';
    const image = meta['og:image'] || '';
    const category = meta.category || '';

    const readTime = estimateReadingTime();

    const authorSlug = author
      ? (authorMap[author.trim().toLowerCase()] || slugify(author))
      : '';

    const firstCategory = category ? category.split(',')[0].trim().replace(/^"|"$/g, '') : '';
    const categorySlug = firstCategory
      ? (categoryMap[firstCategory.toLowerCase()] || slugify(firstCategory))
      : '';

    let imageHtml = '';
    if (image && !image.includes('default-meta-image')) {
      const src = `${image.split('?')[0]}?width=750&format=webply&optimize=medium`;
      const size = await getImageSize(src);
      const dims = size ? `width="${size.width}" height="${size.height}"` : '';
      imageHtml = `<div class="article-header-image"><img src="${src}" alt="${title}" ${dims} fetchpriority="high" loading="eager" /></div>`;
    }

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
      ${imageHtml}
    `;
  }
