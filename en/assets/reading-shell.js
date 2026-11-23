/* Keep Quarto's generated search index and native search behavior. */
(() => {
  'use strict';
  const launcher = document.getElementById('kt-search-launcher');
  launcher?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('kt:search-opening'));
    document.querySelector('#quarto-search button')?.click();
  });
  const nativeSearch = document.getElementById('quarto-search');
  if (nativeSearch) nativeSearch.hidden = true;
  let searchWasOpen = false;
  new MutationObserver(() => {
    const open = document.body.classList.contains('aa-Detached');
    if (open && !searchWasOpen) {
      document.dispatchEvent(new CustomEvent('kt:search-opening'));
      const panel = document.querySelector('.aa-DetachedContainer');
      panel?.setAttribute('role', 'dialog');
      panel?.setAttribute('aria-modal', 'true');
      panel?.setAttribute('aria-label', 'Search the guide');
      const input = panel?.querySelector('.aa-Input');
      input?.removeAttribute('aria-labelledby');
      input?.setAttribute('aria-label', 'Search the guide');
    }
    if (!open && searchWasOpen &&
        (document.activeElement === document.body || nativeSearch?.contains(document.activeElement))) {
      launcher?.focus({preventScroll: true});
    }
    searchWasOpen = open;
  }).observe(document.body, {attributes: true, attributeFilter: ['class']});

  // Native fragment restoration can run before the two-row header and adaptive
  // tables settle. Use the same guarded landing pattern as KT's equipment page.
  const initialHash = location.hash;
  if (initialHash) {
    let interacted = false;
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const mark = () => { interacted = true; };
    inputs.forEach(type => addEventListener(type, mark, {passive: true}));
    const land = async () => {
      await document.fonts.ready;
      if (document.querySelector('.journey-stage-picker-ready')) {
        // Closed stages can leave the shared all-table waiter pending. Only
        // the selected stage can affect this destination's visible layout.
        await new Promise(resolve => {
          const settled = () => {
            const tables = [...document.querySelectorAll('.journey-stage-panel:not([hidden]) .kt-adaptive-records')];
            if (interacted || tables.every(wrap => wrap.dataset.ktAdaptiveReady === 'true' &&
                wrap.classList.contains('kt-record-mode') === (wrap.getBoundingClientRect().width < 576))) resolve();
            else requestAnimationFrame(settled);
          };
          requestAnimationFrame(settled);
        });
      } else await window.ktAdaptiveTables?.whenSettled();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      inputs.forEach(type => removeEventListener(type, mark));
      if (interacted || location.hash !== initialHash) return;
      let id;
      try { id = decodeURIComponent(initialHash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target || !document.getElementById('quarto-document-content')?.contains(target)) return;
      const heading = target.matches('section') ? target.querySelector(':scope > :is(h1,h2,h3,h4)') : null;
      const top = (heading || target).getBoundingClientRect().top;
      const headerBox = document.getElementById('quarto-header')?.getBoundingClientRect();
      // Anchor scrolling can pin a previously hidden mobile header again.
      const header = Math.max(0, headerBox?.bottom || 0, headerBox?.height || 0);
      scrollTo({top: Math.max(0, Math.floor(scrollY + top - Math.max(0, header) - 16)), behavior: 'instant'});
    };
    if (document.readyState === 'complete') land();
    else addEventListener('load', land, {once: true});
  }
})();
