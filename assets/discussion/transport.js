(() => {
  'use strict';
  if (location.origin !== 'https://etheria.carambi.com') return;
  const turnstileSitekey = document.querySelector('meta[name="etheria-discussion-sitekey"]')?.content ?? '';
  if (!/^0x[A-Za-z0-9]{18,60}$/.test(turnstileSitekey)) return;
  const endpoint = 'https://discussion.carambi.com/v1/discussion';
  async function read(path, input, keys) {
    const url = new URL(endpoint + path);
    for (const key of keys) if (input[key] != null && input[key] !== '') url.searchParams.set(key, input[key]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal });
      const body = await response.json();
      if (!response.ok || body?.ok !== true) throw Error('DISCUSSION_READ_FAILED');
      return body;
    } finally { clearTimeout(timer); }
  }
  const legacyReactionTypes = ['like', 'heart', 'smile', 'celebrate', 'thinking'];
  function reactionTypesFor(input) {
    if (input.reactionVersion !== undefined && input.reactionVersion !== 1 && input.reactionVersion !== 2) throw Error('INVALID_REACTION_VERSION');
    return input.reactionVersion === 2 ? [...legacyReactionTypes, 'sad'] : legacyReactionTypes;
  }
  function reactionProtocol(input) {
    reactionTypesFor(input);
    return input.reactionVersion === undefined ? {} : { reactionVersion: input.reactionVersion };
  }
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  function validReaction(row, reactionTypes = legacyReactionTypes) {
    return exactKeys(row, ['commentId', 'counts', 'selected', 'canReact']) && uuid(row.commentId) &&
      exactKeys(row.counts, reactionTypes) && reactionTypes.every(type => Number.isSafeInteger(row.counts[type]) && row.counts[type] >= 0) &&
      Array.isArray(row.selected) && row.selected.length <= reactionTypes.length && new Set(row.selected).size === row.selected.length &&
      row.selected.every(type => reactionTypes.includes(type) && row.counts[type] > 0) && typeof row.canReact === 'boolean';
  }
  async function reactionRequest(path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      let response;
      try { response = await fetch(endpoint + path, { method: 'POST', mode: 'cors', credentials: 'omit',
        signal: controller.signal, redirect: 'error', referrerPolicy: 'no-referrer', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); }
      catch { const error = Error('REACTION_UNKNOWN'); error.outcomeUnknown = true; throw error; }
      let data;
      try { data = await response.json(); } catch { data = null; }
      if (response.status !== 200 || data?.ok !== true) {
        const error = Error('REACTION_FAILED'); error.status = response.status;
        error.code = typeof data?.code === 'string' ? data.code : null;
        error.outcomeUnknown = ![400, 401, 403, 404, 405, 409, 413, 415, 422, 423, 429].includes(response.status);
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  window.__etheriaDiscussionTransport = Object.freeze({
    reactionVersion: 2,
    turnstileSitekey,
    readDiscussion(input) { return read('', input, ['pageKey', 'locale', 'cursor', 'limit']); },
    readSummary(input) { return read('/summary', input, ['locale', 'cursor', 'limit']); },
    async readReactions(input) {
      if (!Array.isArray(input.commentIds) || input.commentIds.length < 1 || input.commentIds.length > 50 ||
          !input.commentIds.every(uuid) || new Set(input.commentIds).size !== input.commentIds.length ||
          (input.visitorId !== undefined && !/^[0-9a-f]{64}$/.test(input.visitorId))) throw Error('INVALID_REACTION_REQUEST');
      const payload = { ...reactionProtocol(input), pageKey: input.pageKey, locale: input.locale, commentIds: input.commentIds };
      if (input.visitorId !== undefined) payload.visitorId = input.visitorId;
      const data = await reactionRequest('/reactions/read', payload);
      if (!Array.isArray(data.reactions) || data.reactions.length !== input.commentIds.length ||
          !data.reactions.every(row => validReaction(row, reactionTypesFor(input)) && input.commentIds.includes(row.commentId)) ||
          new Set(data.reactions.map(row => row.commentId)).size !== data.reactions.length) throw Error('INVALID_REACTION_RESPONSE');
      return { ok: true, reactions: data.reactions };
    },
    async setReaction(input) {
      if (!uuid(input.commentId) || !reactionTypesFor(input).includes(input.type) || !['add', 'remove'].includes(input.intent) ||
          !/^[0-9a-f]{64}$/.test(input.visitorId)) throw Error('INVALID_REACTION_REQUEST');
      const payload = { ...reactionProtocol(input), pageKey: input.pageKey, locale: input.locale, commentId: input.commentId,
        type: input.type, visitorId: input.visitorId, intent: input.intent };
      const data = await reactionRequest('/reactions', payload);
      if (!validReaction(data.reaction, reactionTypesFor(input)) || data.reaction.commentId !== input.commentId) {
        const error = Error('INVALID_REACTION_RESPONSE'); error.outcomeUnknown = true; throw error;
      }
      return { ok: true, reaction: data.reaction };
    },
    async postComment(input) {
      const payload = {
        schemaVersion: 1, pageKey: input.pageKey, locale: input.locale,
        guideVersion: input.guideVersion, displayName: input.displayName, body: input.body,
        pageHash: input.pageHash, parentCommentId: input.parentCommentId,
        replyToCommentId: input.replyToCommentId,
        turnstileToken: input.turnstileToken, honeypot: input.honeypot,
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
      let response;
      try { response = await fetch(endpoint + '/comments', {
        signal: controller.signal, method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      }); } catch {
        const error = Error('DISCUSSION_POST_UNKNOWN'); error.outcomeUnknown = true; throw error;
      }
      let data = null;
      try { data = await response.json(); } catch { /* HTTP status remains authoritative. */ }
      if (response.status === 201) return {
        ok: true, httpStatus: 201, commentId: typeof data?.commentId === 'string' ? data.commentId : null,
      };
      const error = Error('DISCUSSION_POST_FAILED');
      error.outcomeUnknown = ![400, 401, 403, 404, 405, 409, 413, 415, 422, 423, 429].includes(response.status);
      error.code = typeof data?.code === 'string' ? data.code : null;
      error.fieldErrors = data?.fieldErrors && typeof data.fieldErrors === 'object' ? data.fieldErrors : null;
      throw error;
      } finally { clearTimeout(timer); }
    },
  });
})();
