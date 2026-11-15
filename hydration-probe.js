// Vinted size filter - hydration probe (runs in the page's MAIN world).
//
// Vinted is a server-side rendered React app. Anything inserted into the
// item grid before React hydrates it gets wiped out during hydration. React
// marks hydrated DOM nodes with "__reactFiber$<hash>" properties, but those
// are only visible from the page's own JavaScript world, not from the
// isolated world where content.js runs (and where extension APIs such as
// i18n are available).
//
// This script therefore only watches for hydration and reports it to
// content.js through DOM events, which are shared between worlds. It must
// never render user-facing text: extension APIs are not available here.

(function() {
  'use strict';

  const HYDRATED_EVENT = 'vinted-size-filter:hydrated';
  const PING_EVENT = 'vinted-size-filter:ping';
  const ITEM_SELECTOR = '[data-testid="grid-item"], [data-testid="item-page-other_user_items-plugin"] [data-testid^="other_user_items-"]';
  const POLL_INTERVAL_MS = 100;
  const MAX_POLL_MS = 30000;

  let hydrated = false;

  function isHydrated(el) {
    return Object.keys(el).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
  }

  function announce() {
    document.dispatchEvent(new CustomEvent(HYDRATED_EVENT));
  }

  function check() {
    const item = document.querySelector(ITEM_SELECTOR);
    if (item && isHydrated(item)) {
      hydrated = true;
      announce();
    }
    return hydrated;
  }

  // content.js may start before or after this script: it pings on startup,
  // and we answer as soon as hydration is known.
  document.addEventListener(PING_EVENT, () => {
    if (hydrated || check()) announce();
  });

  // Once the page has been hydrated, every later render (infinite scroll,
  // client-side navigation) is a plain client render, so one signal is enough.
  const start = Date.now();
  const timer = setInterval(() => {
    if (check() || Date.now() - start > MAX_POLL_MS) clearInterval(timer);
  }, POLL_INTERVAL_MS);
})();
