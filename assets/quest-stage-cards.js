/* Change the visible row in the existing stage table; leave the quest walkthroughs alone. */
(() => {
  'use strict';
  const tableWrapper = document.querySelector('#quarto-document-content #by-stage > .kt-adaptive-records');
  const rows = Array.from(tableWrapper?.querySelector('table')?.tBodies[0]?.rows || []);
  if (!rows.length) return;

  const stages = rows.map((row) => {
    const cell = row.cells[0];
    const anchor = cell?.querySelector('[id^="stage-"]');
    const title = cell?.querySelector('a')?.textContent.trim();
    const detail = cell?.textContent.trim();
    const suffix = title && detail?.startsWith(title) ? /^\s*·\s*(.+)$/.exec(detail.slice(title.length))?.[1] : null;
    return anchor && title && suffix ? { row, id: anchor.id, title, suffix, detail } : null;
  });
  if (stages.some((stage) => !stage) || new Set(stages.map(({ id }) => id)).size !== stages.length) return;

  const panel = document.createElement('section');
  panel.className = 'etheria-body-finder etheria-quest-stage-cards';
  panel.setAttribute('aria-labelledby', 'etheria-stage-cards-title');
  const heading = document.createElement('p');
  heading.id = 'etheria-stage-cards-title';
  heading.className = 'etheria-finder-title';
  heading.textContent = '按主线阶段找支线';
  const group = document.createElement('div');
  group.className = 'etheria-stage-grid';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', heading.id);
  const status = document.createElement('p');
  status.className = 'etheria-finder-status';
  status.setAttribute('role', 'status');

  const resultId = 'etheria-quest-stage-results';
  const options = [{ id: '', title: '全部阶段' }, ...stages].map((stage) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'etheria-stage-card';
    button.setAttribute('aria-controls', resultId);
    const title = document.createElement('span');
    title.textContent = stage.title;
    button.append(title);
    if (stage.suffix) {
      const code = document.createElement('span');
      code.className = 'etheria-stage-code';
      code.textContent = stage.suffix;
      button.append(code);
    }
    group.append(button);
    return { ...stage, button };
  });

  function show(id) {
    const selected = options.find((option) => option.id === id);
    if (!selected) return;
    for (const { button, id: stageId } of options) button.setAttribute('aria-pressed', String(stageId === id));
    for (const { row, id: stageId } of stages) row.hidden = Boolean(id && stageId !== id);
    status.textContent = id ? `当前：${selected.detail}` : `显示全部 ${stages.length} 段`;
  }

  for (const { id, button } of options) button.addEventListener('click', () => show(id));
  tableWrapper.id = resultId;
  for (const { row } of stages) row.classList.add('etheria-finder-target');
  panel.append(heading, group, status);
  tableWrapper.before(panel);
  show('');

  // Old direct links still reveal their row if a different stage has been selected.
  // Card clicks never navigate, change the hash, or scroll.
  function revealLinkedRow(hash) {
    let target;
    try { target = hash && document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
    const stage = target && stages.find(({ row }) => row.hidden && row.contains(target));
    if (!stage) return null;
    show(stage.id);
    return target;
  }
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) {
      revealLinkedRow(url.hash);
    }
  }, true);
  const revealHash = () => {
    const target = revealLinkedRow(location.hash);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  };
  addEventListener('hashchange', revealHash);
  addEventListener('pageshow', (event) => { if (event.persisted) revealHash(); });
})();
