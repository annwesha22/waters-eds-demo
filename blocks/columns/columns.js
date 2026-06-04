function decorateCover(col) {
  // Pull out the child elements
  const children = [...col.children];
  
  // Check if it's a direct picture, OR a paragraph wrapper containing a picture
  const hasDirectPicture = children.length === 1 && children[0].nodeName === 'PICTURE';
  const hasWrappedPicture = children.length === 1 && children[0].nodeName === 'P' && children[0].querySelector('picture');

  if (hasDirectPicture || hasWrappedPicture) {
    col.classList.add('cover-image');
    col.parentElement.classList.add('cover-row');
    
    // Clean-up: If it's wrapped inside a <p> tag, lift the picture out 
    // so your existing CSS rules ( .cover-image picture ) map perfectly.
    if (hasWrappedPicture) {
      const picture = children[0].querySelector('picture');
      children[0].replaceWith(picture);
    }
  } else {
    col.classList.add('cover-content');
  }
}

function decorateCols(el, cols) {
  const hasCover = el.classList.contains('image-cover');
  for (const [idx, col] of cols.entries()) {
    col.classList.add('col', `col-${idx + 1}`);
    if (hasCover) decorateCover(col);
  }
}

function decorateRows(el, rows) {
  for (const [idx, row] of rows.entries()) {
    row.classList.add('row', `row-${idx + 1}`);
    const cols = [...row.children];
    row.style = `--child-count: ${cols.length}`;
    decorateCols(el, cols);
  }
}

export default function init(el) {
  const rows = [...el.children];
  decorateRows(el, rows);
}
