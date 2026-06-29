export default function init(el) {
  // Block comes in as nested divs; grab the inner text content
  const text = el.textContent.trim();

  // Render clean markup
  el.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = text;
  el.append(p);
}
