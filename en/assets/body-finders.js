/* Lookup in the original tables; no game data or guide text is duplicated. */
(() => {
  'use strict';
  const main = document.getElementById('quarto-document-content');
  if (!main) return;

  const normalized = (text) => text.normalize('NFKC').toLowerCase().replace(/[\s·,()\u2019\u0027]/g, '');
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
      ['swords', 'Drey · Swords', 'Weapons'], ['greatswords', 'Garet · Greatswords', 'Weapons'],
      ['claws', 'Lex · Claws', 'Weapons'], ['jewels', 'Su · Jewels', 'Weapons'],
      ['body-armor', 'Body armor & robes', 'Armor & accessories'], ['head-boots', 'Headgear & boots', 'Armor & accessories'],
      ['accessories-shields', 'Belts, bracelets & shields', 'Armor & accessories'],
    ];
    const groups = typeSpecs.map(([id, label, family]) => {
      const section = main.querySelector(`section#${id}`);
      const table = section?.querySelector(':scope > .kt-adaptive-records > table');
      const rows = Array.from(table?.tBodies[0]?.rows || []);
      if (!section || rows.length === 0 || rows.some((row) => row.cells.length !== 4)) return null;
      return {
        id, label, family, section,
        rows: rows.map((row) => ({ row, terms: normalized(`${row.cells[0].textContent} ${row.cells[2].textContent}`) })),
      };
    });
    if (groups.some((group) => group === null)) return;
    const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
    const { form, controls, status } = lookupPanel('equipment', 'Filter craftable equipment', 'Enter a name or ingredient, choose a category, or combine both. Matching groups open automatically.');
    const search = create('input', { attrs: { type: 'search', placeholder: 'e.g. Loyal Link, Mythril Crystal', autocomplete: 'off' } });
    const types = create('select');
    types.append(new Option('All categories', ''));
    for (const family of ['Weapons', 'Armor & accessories']) {
      const parent = create('optgroup', { attrs: { label: family } });
      for (const group of groups.filter((group) => group.family === family)) parent.append(new Option(group.label, group.id));
      types.append(parent);
    }
    const reset = create('button', { text: 'Clear filters', attrs: { type: 'button' } });
    const jumps = create('div', { className: 'etheria-finder-jumps' });
    controls.append(labeled('Name or ingredient', search, 'etheria-gear-query'), labeled('Character or slot', types, 'etheria-gear-type'), reset);
    form.append(jumps);
    root.querySelector('section#swords').before(form);
    for (const group of groups) {
      group.section.classList.add('etheria-finder-target');
      group.fold = equipmentDisclosure(group.section, group.label, `${group.rows.length} items`);
      group.rows.forEach(({ row }) => row.classList.add('etheria-finder-target'));
    }
    // Keep the starting route and the two recipe indices as persistent wayfinding.
    const topics = [
      ['old-weapons', 'Weapons to save for upgrades', 'Required base weapons and how to unequip them'],
      ['ultimate', 'The four ultimate weapons', 'Recipes, costs and materials'],
      ['unique', 'Other equipment worth finding', 'Arena purchases, quest rewards and cores'],
      ['materials', 'Materials and where to get them', 'Refining, monster drops and crafting materials'],
      ['equipment-cores', 'Soulstones and cores', 'Equipping cores, Su Barrier and realm rewards'],
      ['crafting', 'Crafting, cooking and food', 'Where to cook and what each food does'],
      ['supplies', 'Healing and supplies', 'Camping and restocking'],
      ['battle-basics', 'Battle basics', 'Turn order, AP, SP and skills'],
    ];
    for (const [id, title, note] of topics) {
      const section = main.querySelector(`section#${id}`);
      if (section) equipmentDisclosure(section, title, note);
    }

    function apply() {
      const query = search.value.trim().split(/[\s,]+/).map(normalized).filter(Boolean);
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
      status.textContent = !active ? `${total} craftable items. Open a category below.` : visibleCount
        ? `Showing ${visibleCount} of ${total} craftable items`
        : 'No matching items. Try a shorter search or clear the filters.';
      reset.disabled = !active;
      jumps.hidden = !active || matched.length === 0;
      jumps.replaceChildren();
      if (!jumps.hidden) {
        jumps.append(create('span', { text: 'Jump to results:' }));
        for (const [group, count] of matched) {
          jumps.append(create('a', {
            text: `${group.label} (${count})`, attrs: { href: `#${group.id}`, 'data-etheria-result-jump': '' },
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

  equipmentFinder();
})();
