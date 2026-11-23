(() => {
  'use strict';
  if (window.__ktDiscussionRuntime) return;

  if (location.origin !== 'https://etheria.carambi.com') return;
  const routes = ['journey','quests','exploration','equipment','memories'];
  const pageKeys = Object.freeze(Object.fromEntries([
    ...routes.map(page => ['/' + page + '.html', 'zh.' + page]),
    ['/gm-differences.html', 'zh.gm-differences'],
    ...routes.map(page => ['/en/' + page + '.html', 'en.' + page]),
  ]));

  function getContentHash(hash = location.hash) {
    if (!hash || Array.from(hash).length > 256 || /[?#]/.test(hash.slice(1))) return '';
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return ''; }
    if (/^(?:etheria-comment-|.*discussion)|^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return '';
    const main = document.querySelector('main#quarto-document-content');
    const target = document.getElementById(id);
    if (!target || !main?.contains(target) || target === main ||
        target.closest('nav,header,footer,aside,form,dialog,.quarto-title-block,.quarto-title,.footnotes,#TOC,[role="doc-endnotes"],[role="navigation"],[role="dialog"]') ||
        !target.matches('section,h2,h3,h4,h5,h6,p,li,table,blockquote,figure,pre')) return '';
    return hash;
  }

  function getContext() {
    const htmlLang = document.documentElement.lang;
    const locale = htmlLang === 'zh-Hans' ? 'zh-CN' : htmlLang;
    if (locale !== 'en' && locale !== 'zh-CN') return null;
    const pagePath = location.pathname;
    if ((locale === 'en') !== pagePath.startsWith('/en/')) return null;
    return Object.freeze({
      site: 'etheria',
      locale,
      pageKey: Object.hasOwn(pageKeys, pagePath) ? pageKeys[pagePath] : null,
      guideVersion: 'discussion',
      pagePath,
      pageHash: location.hash,
      viewportClass: matchMedia('(min-width: 768px)').matches ? 'desktop' : 'mobile',
    });
  }

  const transport = window.__etheriaDiscussionTransport ?? null;
  window.__ktDiscussionRuntime = Object.freeze({ getContext, getContentHash, transport, mode: transport ? 'production' : 'inactive' });
  const context = getContext();
  if (!context?.pageKey || !transport) return;
  const main = document.querySelector('#quarto-content > main#quarto-document-content');
  if (!main || document.getElementById('kt-public-discussion')) return;
  const mount = document.createElement('div');
  mount.id = 'kt-public-discussion';
  mount.hidden = true;
  mount.setAttribute('data-kt-discussion-mount', '');
  mount.dataset.pageKey = context.pageKey;
  main.after(mount);
})();
