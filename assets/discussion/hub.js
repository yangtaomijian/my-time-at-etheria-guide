(() => {
  'use strict';
  if (location.origin !== 'https://etheria.carambi.com' || !window.__etheriaDiscussionTransport) return;
  const homepage = document.querySelector('[data-etheria-hub-link]');
  if (homepage) { homepage.hidden = false; return; }
  const root = document.querySelector('[data-etheria-hub]');
  if (!root) return;
  const chinese = document.documentElement.lang === 'zh-Hans';
  const locale = chinese ? 'zh-CN' : 'en';
  const prefix = chinese ? 'zh.' : 'en.';
  const known = new Set(['journey','quests','exploration','equipment','memories',...(chinese ? ['gm-differences'] : [])]);
  const status = root.querySelector('[role=status]');
  const list = root.querySelector('ol');
  const more = root.querySelector('button');
  let cursor = '', rendered = 0;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function element(tag, value) {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  }
  function add(row) {
    const key = row.pageKey;
    if (row.locale !== locale || typeof key !== 'string' || !key.startsWith(prefix) ||
        !known.has(key.slice(prefix.length)) || !uuid.test(row.latestCommentId)) return;
    const item = document.createElement('li');
    const title = element('a', row.pageTitle);
    const target = new URL('./' + key.slice(prefix.length) + '.html', location.href);
    target.hash = 'etheria-comment-' + row.latestCommentId;
    title.href = target.href;
    const excerpt = element('p', row.summary);
    const count = Number.isSafeInteger(row.replyCount) && row.replyCount >= 0 ? row.replyCount : 0;
    const info = document.createElement('div');
    info.className = 'discussion-info';
    info.append(element('span', chinese ? count + ' 条回复' : count + (count === 1 ? ' reply' : ' replies')));
    const time = new Date(row.lastActivityAt);
    if (Number.isFinite(time.valueOf())) {
      const timestamp = element('time', new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(time));
      timestamp.dateTime = time.toISOString();
      info.append(timestamp);
    }
    item.append(title, excerpt, info);
    list.append(item);
    rendered++;
  }
  async function load() {
    more.disabled = true;
    status.textContent = chinese ? '正在加载讨论…' : 'Loading discussions…';
    try {
      const query = new URLSearchParams({locale,limit:'12'});
      if (cursor) query.set('cursor',cursor);
      const data = await window.__etheriaDiscussionTransport.readSummary(Object.fromEntries(query));
      if (!Array.isArray(data.discussions)) throw Error('Unavailable');
      data.discussions.forEach(add);
      cursor = typeof data.nextCursor === 'string' ? data.nextCursor : '';
      status.textContent = rendered ? '' : chinese ? '还没有讨论。' : 'No discussions yet.';
      more.hidden = !cursor;
      more.textContent = chinese ? '加载更多' : 'Load more';
    } catch {
      status.textContent = chinese ? '讨论暂时加载失败。' : 'Could not load discussions.';
      more.hidden = false;
      more.textContent = chinese ? '重试' : 'Retry';
    } finally {
      more.disabled = false;
    }
  }
  more.addEventListener('click',load);
  load();
})();
