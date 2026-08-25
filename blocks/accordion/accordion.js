import { decorateIcons } from '../../scripts/aem.js';

function buildIcon(name) {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  return span;
}

export default function decorate(block) {
  [...block.children].forEach((row) => {
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';

    const labelText = document.createElement('span');
    labelText.className = 'accordion-item-label-text';
    labelText.append(...label.childNodes);

    const iconWrap = document.createElement('span');
    iconWrap.className = 'accordion-item-icon';
    iconWrap.append(buildIcon('expand'), buildIcon('collapse'));

    summary.append(labelText, iconWrap);

    const body = row.children[1];
    body.className = 'accordion-item-body';

    const details = document.createElement('details');
    details.className = 'accordion-item';
    details.append(summary, body);
    row.replaceWith(details);
  });

  decorateIcons(block);
}
