/* The guide remains fully readable before this optional presentation layer runs. */
(() => {
  'use strict';
  const main = document.getElementById('quarto-document-content');
  const local = main?.querySelector('section#local');
  const quickTable = local?.querySelector(':scope > .kt-adaptive-records');
  if (!local || !quickTable) return;

  const localSections = [...local.querySelectorAll(':scope > section.level3[id]')];
  const byId = new Map(localSections.map((section) => [section.id, section]));
  const rowLinks = [...quickTable.querySelectorAll('tbody tr > td:first-child > a[href^="#"]')];
  const localRows = rowLinks.map((link) => ({ link, section: byId.get(link.getAttribute('href').slice(1)) }));
  const canFilter = localRows.length && localRows.length === localSections.length &&
    localRows.every(({ section }) => section) && new Set(localRows.map(({ section }) => section)).size === localSections.length;

  if (canFilter) {
    for (const { section, link } of localRows) {
      section.classList.add('etheria-finder-target');
      link.classList.add('etheria-quest-regional-link');
      link.setAttribute('aria-controls', section.id);
    }
  }
  function showRegional(selection) {
    if (!canFilter) return;
    for (const { section, link } of localRows) {
      const active = section === selection;
      section.hidden = !active;
      link.setAttribute('aria-expanded', String(active));
    }
  }

  const introFolds = new Map();
  function makeFold(label) {
    const details = document.createElement('details');
    details.className = 'etheria-quest-fold';
    const summary = document.createElement('summary');
    summary.textContent = label;
    details.append(summary);
    return details;
  }

  // Keep each summary and reward in sight; fold the individual route steps.
  for (const [id, label] of [
    ['messenger', "The Messenger: deliveries and turn-in"],
    ['slibs', "Finding Slibs: locations and recipes"],
  ]) {
    const section = main.querySelector(`section#${id}`);
    const lead = section?.querySelector(':scope > h2 + p');
    if (!lead || !lead.nextElementSibling) continue;
    const fold = makeFold(label);
    while (lead.nextSibling) fold.append(lead.nextSibling);
    section.append(fold);
    introFolds.set(section, fold);
  }
  for (const [id, label] of [
    ['cursed-harness', "The Cursed Harness"],
    ['cursed-gloves', "The Cursed Gloves"],
    ['cursed-boots', "The Cursed Boots"],
    ['union-link', "Union Link"],
    ['the-kings-request', "The King's Request!"],
  ]) {
    const section = main.querySelector(`section#${id}`);
    if (!section?.matches('.level3')) continue;
    const fold = makeFold(label);
    section.before(fold);
    fold.append(section);
  }

  function targetFor(hash) {
    try { return hash && document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }
  function regionalFor(target) {
    return canFilter && target && localSections.find((section) => section.contains(target));
  }
  function revealTarget(target) {
    if (!target || !main.contains(target)) return false;
    let changed = false;
    const selection = regionalFor(target);
    if (selection?.hidden) {
      showRegional(selection);
      changed = true;
    }
    const introFold = introFolds.get(target);
    if (introFold && !introFold.open) {
      introFold.open = true;
      changed = true;
    }
    // Nested example disclosures are also revealed through their original IDs.
    for (let fold = target.closest('details'); fold; fold = fold.parentElement.closest('details')) {
      if (!fold.open) {
        fold.open = true;
        changed = true;
      }
    }
    return changed;
  }

  showRegional(regionalFor(targetFor(location.hash)));
  revealTarget(targetFor(location.hash));
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) {
      revealTarget(targetFor(url.hash));
    }
  }, true);
  const revealHash = () => {
    const target = targetFor(location.hash);
    if (revealTarget(target)) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  };
  addEventListener('hashchange', revealHash);
  addEventListener('pageshow', (event) => { if (event.persisted) revealHash(); });
})();
