export default function init(el) {
  const placeholder = el.querySelector('p')?.textContent?.trim() || 'Search topics, titles, and authors';

  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'search-wrapper';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = placeholder;

  const btn = document.createElement('button');
  btn.className = 'search-btn';
  btn.setAttribute('aria-label', 'Search');
  btn.innerHTML = `<svg class="icon icon-search">
    <use href="/img/icons/search.svg#search"></use>
  </svg>`;

  btn.addEventListener('click', () => {
    const query = input.value.trim();
    if (query) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });

  wrapper.append(input, btn);
  el.append(wrapper);
}
