/* Lookup in the original tables; no game data or guide text is duplicated. */
(() => {
  'use strict';
  const main = document.getElementById('quarto-document-content');
  if (!main) return;

  const normalized = (text) => text.normalize('NFKC').toLowerCase().replace(/[\s·、,，()]/g, '');
  const wording = [
    ['忠诚连接', '忠诚之绊'], ['阿尔法之诺', '阿尔法之绊'],
    ['古代盔甲', '古代护甲'], ['耐用腰带', '坚固腰带'], ['古代圆盾', '古代小圆盾'],
    ['寒铁矿', '铁矿石'], ['寒铁锭', '铁锭'], ['火焰宝石', '火之宝石'],
    ['大地宝石', '土之宝石'], ['海洋宝石', '水之宝石'], ['疾风宝石', '风之宝石'],
  ];
  function withAliases(text) {
    const base = normalized(text);
    return [base, ...wording.filter((pair) => pair.some((term) => base.includes(term))).flat()].join('\n');
  }
  function create(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.text) element.textContent = options.text;
    if (options.className) element.className = options.className;
    for (const [name, value] of Object.entries(options.attrs || {})) element.setAttribute(name, value);
    return element;
  }
  function lookupPanel(kind, title, description) {
    const form = create('form', {
      className: 'etheria-body-finder',
      attrs: { id: `etheria-${kind}-finder`, role: 'search', 'aria-label': title },
    });
    form.addEventListener('submit', (event) => event.preventDefault());
    form.append(
      create('p', { text: title, className: 'etheria-finder-title' }),
      create('p', { text: description, className: 'etheria-finder-note' }),
    );
    const controls = create('div', { className: 'etheria-finder-controls' });
    const status = create('p', { className: 'etheria-finder-status', attrs: { role: 'status' } });
    form.append(controls, status);
    return { form, controls, status };
  }
  function labeled(label, control, id) {
    const field = create('div', { className: 'etheria-finder-field' });
    control.id = id;
    field.append(create('label', { text: label, attrs: { for: id } }), control);
    return field;
  }
  function fragment(hash) {
    try { return hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; }
    catch { return null; }
  }
  function samePageDestination(link) {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return null;
    return fragment(url.hash);
  }
  function revealForLinks(reveal, shouldSkip = () => false) {
    document.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (link && !shouldSkip(link)) reveal(samePageDestination(link));
    }, true);
    const revealHash = () => {
      const target = fragment(location.hash);
      // A hash reached via back/forward may have been hidden during native scrolling.
      if (target && reveal(target)) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    };
    addEventListener('hashchange', revealHash);
    addEventListener('pageshow', (event) => { if (event.persisted) revealHash(); });
  }

  function equipmentDisclosure(section, title, note) {
    const fold = create('details', { className: 'etheria-equipment-fold' });
    const summary = create('summary');
    summary.append(create('span', { text: title }), create('span', { text: note, className: 'etheria-gear-fold-note' }));
    section.before(fold);
    fold.append(summary, section);
    return fold;
  }

  function equipmentFinder() {
    const root = main.querySelector('section#weapon-index');
    if (!root) return;
    const typeSpecs = [
      ['swords', '主角 · 剑', '武器'], ['greatswords', '加雷特 · 大剑', '武器'],
      ['claws', '莱克斯 · 爪', '武器'], ['jewels', '小水 · 宝珠', '武器'],
      ['body-armor', '身体 · 护甲与长袍', '防具与饰品'], ['head-boots', '头部与靴子', '防具与饰品'],
      ['accessories-shields', '腰带、手镯与盾', '防具与饰品'],
    ];
    const groups = typeSpecs.map(([id, label, family]) => {
      const section = main.querySelector(`section#${id}`);
      const table = section?.querySelector(':scope > .kt-adaptive-records > table');
      const rows = Array.from(table?.tBodies[0]?.rows || []);
      if (!section || rows.length === 0 || rows.some((row) => row.cells.length !== 4)) return null;
      return {
        id, label, family, section,
        rows: rows.map((row) => ({ row, terms: withAliases(`${row.cells[0].textContent} ${row.cells[2].textContent}`) })),
      };
    });
    if (groups.some((group) => group === null)) return;
    const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
    const { form, controls, status } = lookupPanel('equipment', '查合成装备', '可直接输入名称或材料，也可以选角色、部位。找到的记录会直接展开。');
    const search = create('input', { attrs: { type: 'search', placeholder: '如：忠诚连接、秘银水晶', autocomplete: 'off' } });
    const types = create('select');
    types.append(new Option('全部类别', ''));
    for (const family of ['武器', '防具与饰品']) {
      const parent = create('optgroup', { attrs: { label: family } });
      for (const group of groups.filter((group) => group.family === family)) parent.append(new Option(group.label, group.id));
      types.append(parent);
    }
    const reset = create('button', { text: '清除筛选', attrs: { type: 'button' } });
    const jumps = create('div', { className: 'etheria-finder-jumps' });
    controls.append(labeled('名称或材料', search, 'etheria-gear-query'), labeled('角色或部位', types, 'etheria-gear-type'), reset);
    form.append(jumps);
    root.querySelector('section#swords').before(form);
    for (const group of groups) {
      group.section.classList.add('etheria-finder-target');
      group.fold = equipmentDisclosure(group.section, group.label, `${group.rows.length} 条`);
      group.rows.forEach(({ row }) => row.classList.add('etheria-finder-target'));
    }
    // Keep the starting route and the two recipe indices as persistent wayfinding.
    const topics = [
      ['old-weapons', '哪些旧武器要留', '升级要用的旧武器，以及怎样换下来'],
      ['ultimate', '四把终极武器', '配方、兑换门槛与材料'],
      ['unique', '其他特殊装备', '竞技场兑换、任务奖励与核心'],
      ['materials', '重要材料', '普通矿锭、秘银精炼与魔物材料'],
      ['equipment-cores', '灵魂石与核心', '怎么装核心、小水护盾与秘境配方'],
      ['crafting', '合成、烹饪与食物', '在哪里做饭，按效果选食物'],
      ['supplies', '恢复与随身补给', '营火、雷鸥港购物与整备时机'],
      ['battle-basics', '战斗入门', '行动顺序、AP、SP 与技能来源'],
    ];
    for (const [id, title, note] of topics) {
      const section = main.querySelector(`section#${id}`);
      if (section) equipmentDisclosure(section, title, note);
    }

    function apply() {
      const query = search.value.trim().split(/[\s,，、]+/).map(normalized).filter(Boolean);
      const active = query.length > 0 || types.value !== '';
      const matched = [];
      let visibleCount = 0;
      for (const group of groups) {
        let count = 0;
        for (const { row, terms } of group.rows) {
          const matches = (!types.value || types.value === group.id) && query.every((part) => terms.includes(part));
          row.hidden = !matches;
          if (matches) count += 1;
        }
        group.section.hidden = active && count === 0;
        group.fold.hidden = group.section.hidden;
        group.fold.open = active && count > 0;
        group.fold.classList.toggle('etheria-gear-filtering', active);
        if (count) matched.push([group, count]);
        visibleCount += count;
      }
      status.textContent = !active ? `共 ${total} 条合成记录，按下方类别展开。` : visibleCount
        ? `显示 ${visibleCount} / ${total} 条合成记录`
        : '没有符合条件的合成装备。可以改短关键词，或清除筛选。';
      reset.disabled = !active;
      jumps.hidden = !active || matched.length === 0;
      jumps.replaceChildren();
      if (!jumps.hidden) {
        jumps.append(create('span', { text: '跳到结果：' }));
        for (const [group, count] of matched) {
          jumps.append(create('a', {
            text: `${group.label}（${count}）`, attrs: { href: `#${group.id}`, 'data-etheria-result-jump': '' },
          }));
        }
      }
    }
    function clear() { search.value = ''; types.value = ''; apply(); }
    let composing = false;
    search.addEventListener('compositionstart', () => { composing = true; });
    search.addEventListener('compositionend', () => { composing = false; apply(); });
    search.addEventListener('input', (event) => { if (!composing && !event.isComposing) apply(); });
    types.addEventListener('change', apply);
    reset.addEventListener('click', () => { clear(); search.focus({ preventScroll: true }); });
    function revealTarget(target) {
      if (!target || !main.contains(target)) return false;
      let changed = false;
      if (target.closest('.etheria-finder-target[hidden]')) {
        // An explicit link to an excluded result restores the unfiltered table.
        clear();
        changed = true;
      }
      for (let fold = target.closest('details.etheria-equipment-fold'); fold;
        fold = fold.parentElement.closest('details.etheria-equipment-fold')) {
        if (!fold.open) {
          fold.open = true;
          changed = true;
        }
      }
      return changed;
    }
    revealForLinks(revealTarget);
    apply();
    revealTarget(fragment(location.hash));
  }

  function stageFinder() {
    const stage = main.querySelector('section#by-stage');
    const tableWrapper = stage?.querySelector(':scope > .kt-adaptive-records');
    const rows = Array.from(tableWrapper?.querySelector('table')?.tBodies[0]?.rows || []);
    if (!rows.length) return;
    const stages = rows.map((row) => ({
      row, anchor: row.cells[0]?.querySelector('[id^="stage-"]'), title: row.cells[0]?.textContent.trim(),
    }));
    if (stages.some(({ anchor, title }) => !anchor || !title) || new Set(stages.map((entry) => entry.anchor.id)).size !== stages.length) return;
    const { form, controls, status } = lookupPanel('quest-stage', '按主线阶段找支线', '选当前阶段，就只看这一行。下方的完整任务流程不变。');
    const select = create('select');
    select.append(new Option('全部阶段', ''));
    for (const { row, anchor, title } of stages) {
      select.append(new Option(title, anchor.id));
      row.classList.add('etheria-finder-target');
    }
    controls.append(labeled('当前主线阶段', select, 'etheria-stage-select'));
    tableWrapper.before(form);
    function apply() {
      for (const { row, anchor } of stages) row.hidden = Boolean(select.value && select.value !== anchor.id);
      const selected = stages.find(({ anchor }) => anchor.id === select.value);
      status.textContent = selected ? `当前：${selected.title}` : `显示全部 ${stages.length} 段`;
    }
    select.addEventListener('change', apply);
    revealForLinks((target) => {
      const entry = target && stages.find(({ row }) => row.hidden && row.contains(target));
      if (!entry) return false;
      select.value = entry.anchor.id;
      apply();
      return true;
    });
    apply();
  }

  equipmentFinder();
  stageFinder();
})();
