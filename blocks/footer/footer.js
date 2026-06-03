import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';

const FOOTER_PATH = '/fragments/nav/footer';

/**
 * loads and decorates the footer
 * @param {Element} el The footer element
 */
export default async function init(el) {
  const { locale } = getConfig();
  const footerMeta = getMetadata('footer');
  const path = footerMeta || FOOTER_PATH;
   console.log('locale:', locale);
  console.log('locale.prefix:', locale?.prefix);
  console.log('footerMeta:', footerMeta);
  console.log('path:', path);
  console.log('before fragment path:', `${locale?.prefix || ''}${path}`);
  try {
    const fragment = await loadFragment(`${locale.prefix}${path}`);
    console.log('after fragment path:', fragment);
    fragment.classList.add('footer-content');

    const sections = [...fragment.querySelectorAll('.section')];

    const bottom = sections.pop();
    if (bottom) bottom.classList.add('section-bottom');

    const top = sections[0];
    if (top) top.classList.add('section-top');

    el.append(fragment);
  } catch (e) {
    throw Error(e);
  }
}
