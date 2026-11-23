/* Keep the authored sections and stable anchors; select a stage near its cards. */
(() => {
  'use strict';
  const picker = document.querySelector('.journey-stage-picker');
  if (!picker) return;
  picker.id ||= 'journey-stage-list';
  const cards = [...picker.querySelectorAll('.journey-stage-card[href]')];
  const entries = cards.map(card => {
    const id = decodeURIComponent(card.hash.slice(1));
    const section = document.getElementById(id);
    const group = card.closest('.journey-stage-group');
    return {id, card, section, group, mount: group?.querySelector('.journey-stage-panels')};
  });
  if (!entries.length || entries.some(e => !e.section || !e.mount)) return;
  let selected = null;
  const toc = document.getElementById('TOC');
  const tocLinks = [...(toc?.querySelectorAll('a[href]') || [])];
  const tocTargets = new Set(tocLinks.map(link => link.hash.slice(1)));
  const tocBranches = [...(toc?.querySelectorAll(':scope > ul > li') || [])]
    .map(branch => ({ branch, hash: branch.querySelector(':scope > a[href]')?.hash }));
  let tocFrame = 0;

  function queueToc() {
    if (tocFrame) return;
    tocFrame = requestAnimationFrame(() => {
      tocFrame = 0;
      const headerBox = document.getElementById('quarto-header')?.getBoundingClientRect();
      const header = Math.max(0, headerBox?.bottom || 0, headerBox?.height || 0);
      const basics = document.querySelector('#basics > h2');
      const activeStage = selected?.group.open ? selected : null;
      // Filter only the top-level TOC branches; preserve each visible branch's own toggles and links.
      for (const { branch, hash } of tocBranches) {
        const hidden = Boolean(activeStage && hash !== activeStage.card.hash);
        if (branch.hidden !== hidden) branch.hidden = hidden;
      }
      let current = activeStage?.id || null;
      if (current) {
        for (const section of activeStage.section.querySelectorAll('section[id]')) {
          const heading = section.querySelector(':scope > h3, :scope > h4');
          if (heading && tocTargets.has(section.id) && section.getBoundingClientRect().top <= header + 24) current = section.id;
        }
      }
      if (!activeStage && basics && basics.getBoundingClientRect().top <= header + 24) current = 'basics';
      for (const link of tocLinks) {
        const active = current !== null && link.hash === '#' + current;
        if (link.classList.contains('active') !== active) link.classList.toggle('active', active);
      }
    });
  }

  function select(entry) {
    selected = entry;
    for (const item of entries) {
      const active = item === entry;
      item.section.hidden = !active;
      item.card.setAttribute('aria-expanded', String(active));
      if (active) item.card.setAttribute('aria-current', 'location');
      else item.card.removeAttribute('aria-current');
    }
    if (entry) entry.group.open = true;
    queueToc();
  }

  function close() {
    select(null);
    history.replaceState(history.state, '', location.pathname + location.search);
  }

  function entryFor(hash) {
    let target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
    return entries.find(e => e.section === target || e.section.contains(target)) || null;
  }

  function revealHash() {
    const entry = entryFor(location.hash);
    if (entry) select(entry);
    else if (!location.hash || location.hash === '#' + picker.id) select(null);
    return entry;
  }

  function restoreHistory() {
    const entry = revealHash();
    const hash = location.hash;
    let target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return; }
    if (!entry && target !== picker && !document.getElementById('basics')?.contains(target)) return;
    // A hidden stage changes document height before native history restores
    // its old scroll offset. Basics is outside those panels but its anchors
    // also need the heading offset when reached from an already open stage.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (location.hash !== hash || (entry && (selected !== entry || !entry.group.open))) return;
      const heading = target?.querySelector(':scope > h2, :scope > h3, :scope > h4') || target;
      if (!heading) return;
      const headerBox = document.getElementById('quarto-header')?.getBoundingClientRect();
      const header = Math.max(0, headerBox?.bottom || 0, headerBox?.height || 0);
      scrollTo({top: Math.max(0, Math.floor(scrollY + heading.getBoundingClientRect().top - Math.max(0, header) - 16)), behavior: 'instant'});
      queueToc();
    }));
  }

  for (const [index, entry] of entries.entries()) {
    entry.section.classList.add('journey-stage-panel');
    entry.card.setAttribute('aria-controls', entry.id);
    entry.mount.append(entry.section);
    const pager = document.createElement('nav');
    pager.className = 'journey-stage-pager';
    pager.setAttribute('aria-label', '切换主线阶段');
    for (const [neighbor, direction, label] of [
      [entries[index - 1], 'previous', '上一段'],
      [entries[index + 1], 'next', '下一段'],
    ]) {
      if (!neighbor) continue;
      const link = document.createElement('a');
      link.className = 'journey-stage-page-link journey-stage-page-' + direction;
      link.href = neighbor.card.hash;
      const directionLabel = document.createElement('span');
      directionLabel.textContent = direction === 'previous' ? '← ' + label : label + ' →';
      const title = document.createElement('strong');
      title.textContent = neighbor.card.querySelector('strong')?.textContent || neighbor.id;
      link.append(directionLabel, title);
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        select(neighbor);
        history.pushState(history.state, '', link.hash);
        const heading = neighbor.section.querySelector(':scope > h2');
        if (heading) {
          heading.tabIndex = -1;
          heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), {once: true});
          heading.focus({preventScroll: true});
        }
        restoreHistory();
      });
      pager.append(link);
    }
    const listLink = document.createElement('a');
    listLink.href = '#' + picker.id;
    listLink.className = 'journey-stage-list-link';
    listLink.textContent = '回任务列表';
    listLink.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(null);
      history.pushState(history.state, '', listLink.hash);
      const summary = entry.group.querySelector(':scope > summary');
      summary?.focus({preventScroll: true});
      restoreHistory();
    });
    pager.append(listLink);
    entry.section.append(pager);
    entry.card.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (selected === entry && entry.group.open) {
        close();
        return;
      }
      select(entry);
      history.pushState(history.state, '', entry.card.hash);
    });
  }
  picker.classList.add('journey-stage-picker-ready');
  select(null);
  revealHash();

  // Reveal a hidden destination before the browser performs native anchor scrolling.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || link.classList.contains('journey-stage-card')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const entry = entryFor(url.hash);
    if (entry) select(entry);
    else {
      let target;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); }
      catch { return; }
      // The shared TOC updates history without firing hashchange.
      if (document.getElementById('basics')?.contains(target)) requestAnimationFrame(restoreHistory);
    }
  }, true);
  addEventListener('hashchange', restoreHistory);
  addEventListener('popstate', restoreHistory);
  addEventListener('scroll', queueToc, {passive: true});
  addEventListener('resize', queueToc, {passive: true});
  picker.querySelectorAll('.journey-stage-group').forEach(group => group.addEventListener('toggle', queueToc));
  // Quarto measures the authored continuous article; hidden stages need the selected cue.
  if (toc) new MutationObserver(queueToc).observe(toc, {
    subtree: true, attributes: true, attributeFilter: ['class']
  });
})();
