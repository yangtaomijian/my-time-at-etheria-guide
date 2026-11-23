/* Filter the existing exploration topics in place, while keeping their original URLs. */
(() => {
  'use strict';
  const first = document.querySelector('#quarto-document-content .kt-ordinary-page > #realms');
  if (!first) return;
  const categoryLabels = new Map([
    ['realms', '秘境速查'], ['wind', '风之秘境'], ['water', '水之秘境'],
    ['earth', '土之秘境'], ['fire', '火之秘境'], ['arena', '竞技场'],
  ]);
  const categories = [...first.parentElement.querySelectorAll(':scope > section.level2[id]')];
  if (categories.length !== categoryLabels.size || categories.some((section) => !categoryLabels.has(section.id))) return;
  const branches = [...document.querySelectorAll('#TOC > ul > li')];

  const panel = document.createElement('section');
  panel.className = 'etheria-body-finder etheria-exploration-cards';
  panel.setAttribute('aria-labelledby', 'etheria-exploration-cards-title');
  const heading = document.createElement('p');
  heading.id = 'etheria-exploration-cards-title';
  heading.className = 'etheria-finder-title';
  heading.textContent = '按主题查看';
  const group = document.createElement('div');
  group.className = 'etheria-stage-grid';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', heading.id);
  const status = document.createElement('p');
  status.className = 'etheria-finder-status';
  status.setAttribute('role', 'status');
  const options = [...categoryLabels, ['', '显示全部']].map(([id, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'etheria-stage-card';
    button.textContent = label;
    button.setAttribute('aria-controls', id || [...categoryLabels.keys()].join(' '));
    button.addEventListener('click', () => show(id));
    group.append(button);
    return { id, label, button };
  });

  for (const section of categories) section.classList.add('etheria-exploration-category');
  const tocTopics = branches.map((branch) => {
    const id = branch.querySelector(':scope > a[href]')?.hash.slice(1);
    if (!categoryLabels.has(id)) return null;
    branch.classList.add('etheria-exploration-branch');
    return { id, branch };
  }).filter(Boolean);
  function show(id) {
    const selected = options.find((option) => option.id === id);
    if (!selected) return;
    for (const { button, id: optionId } of options) button.setAttribute('aria-pressed', String(optionId === id));
    for (const section of categories) section.hidden = Boolean(id && section.id !== id);
    // The shared directory is for the subsections that are actually visible.
    for (const { branch, id: branchId } of tocTopics) branch.hidden = Boolean(id && branchId !== id);
    status.textContent = id ? `当前：${selected.label}` : '显示全部主题';
  }

  function hashTarget(hash) {
    try { return hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; }
    catch { return null; }
  }
  function categoryFor(target) {
    return target && categories.find((section) => section.contains(target));
  }
  function revealLinkedCategory(hash) {
    const target = hashTarget(hash);
    const category = categoryFor(target);
    if (!category?.hidden) return null;
    show(category.id);
    return target;
  }

  panel.append(heading, group, status);
  first.before(panel);
  // Run before initial fragment scrolling: search and cross-page URLs open the right topic.
  show(categoryFor(hashTarget(location.hash))?.id || first.id);

  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) {
      revealLinkedCategory(url.hash);
    }
  }, true);
  const revealHash = () => {
    const target = revealLinkedCategory(location.hash);
    // Only actual fragment navigation scrolls; selecting a filter card does not.
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  };
  addEventListener('hashchange', revealHash);
  addEventListener('pageshow', (event) => { if (event.persisted) revealHash(); });
})();
