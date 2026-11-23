(() => {
  // A preview link can request its initial appearance. Native controls own it
  // afterwards, including Auto; reloading must not reapply an old query choice.
  const url = new URL(location.href);
  const requested = url.searchParams.get('appearance');
  if (!['light', 'dark'].includes(requested)) return;
  const current = document.body.classList.contains('quarto-dark') ? 'dark' : 'light';
  if (requested !== current && typeof window.quartoToggleColorScheme === 'function') {
    window.quartoToggleColorScheme();
  }
  url.searchParams.delete('appearance');
  history.replaceState(history.state, '', url);
})();
