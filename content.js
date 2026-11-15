// Vinted size filter - content script (runs in the extension's isolated world).
//
// Finds the item grid (member profile page, or "Member's wardrobe" section on
// an item page) and inserts a size filter above it.
//
// Vinted is a server-side rendered React app: anything inserted before React
// hydrates the page is wiped out. We wait for hydration-probe.js to report
// that hydration is done, then keep watching the DOM to re-insert the filter
// whenever Vinted re-renders the grid.

(function() {
  'use strict';

  const ext = globalThis.browser ?? globalThis.chrome;

  const FILTER_ATTR = 'data-vinted-size-filter';
  const HYDRATED_EVENT = 'vinted-size-filter:hydrated';
  const PING_EVENT = 'vinted-size-filter:ping';
  // Used if the probe never answers (e.g. React internals changed).
  const HYDRATION_FALLBACK_MS = 4000;
  const SYNC_DEBOUNCE_MS = 150;
  const SIZE_SEPARATOR = ' · ';

  let filterContainer = null;
  let itemsMap = new Map();       // item DOM container -> sizes
  let sizeCheckboxes = new Map(); // size -> checkbox
  let checkedStates = new Map();  // size -> checked (survives re-renders)
  let anchor = null;              // element the filter is inserted before
  let lastUrl = location.href;
  let scheduled = null;
  let pageHydrated = false;
  let itemsFirstSeenAt = 0;

  function t(key) {
    return ext.i18n.getMessage(key);
  }

  function isMemberPage() {
    return /^\/member\/\d+/.test(location.pathname);
  }

  /**
   * Returns the items, the element to insert the filter before, and the DOM
   * container to hide for each item. Vinted's CSS classes are hashed
   * (e.g. "HmDNda_feed-grid"), so we rely on data-testid attributes only.
   */
  function findSection() {
    if (isMemberPage()) {
      const items = Array.from(document.querySelectorAll('[data-testid="grid-item"]'));
      if (items.length === 0) return null;
      const grid = items[0].parentElement;
      if (!grid || !grid.parentElement) return null;
      return { items, anchor: grid, containers: items };
    }

    // Item page: "Member's wardrobe" section
    const plugin = document.querySelector('[data-testid="item-page-other_user_items-plugin"]');
    if (!plugin) return null;
    const items = Array.from(plugin.querySelectorAll('[data-testid^="other_user_items-"]'))
      .filter(el => /^other_user_items-\d+$/.test(el.getAttribute('data-testid')));
    if (items.length === 0) return null;
    // Hide the grid cell wrapping the item, not just the item card.
    const containers = items.map(item => {
      const cell = item.parentElement;
      return cell && cell.parentElement && cell.parentElement.getAttribute('data-testid') === 'item-view-items'
        ? cell
        : item;
    });
    return { items, anchor: plugin, containers };
  }

  function isReadyToInsert() {
    if (pageHydrated) return true;
    if (!itemsFirstSeenAt) itemsFirstSeenAt = Date.now();
    return Date.now() - itemsFirstSeenAt > HYDRATION_FALLBACK_MS;
  }

  /**
   * Expected subtitle format: "W31 | FR 40 · Très bon état" -> "W31 | FR 40"
   */
  function extractSize(text) {
    if (!text) return null;
    const size = text.split(SIZE_SEPARATOR)[0].trim();
    return size || null;
  }

  function extractSizes(section) {
    itemsMap = new Map();
    const sizes = new Set();
    section.items.forEach((item, i) => {
      const subtitle = item.querySelector('[data-testid*="--description-subtitle"]');
      const size = subtitle ? extractSize(subtitle.textContent) : null;
      if (!size) return;
      const container = section.containers[i];
      if (!itemsMap.has(container)) itemsMap.set(container, []);
      itemsMap.get(container).push(size);
      sizes.add(size);
    });
    return Array.from(sizes).sort();
  }

  function buildFilter(uniqueSizes) {
    const container = document.createElement('div');
    container.className = 'vinted-size-filter-container';
    container.setAttribute(FILTER_ATTR, '');
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', t('filterTitle'));

    const title = document.createElement('div');
    title.className = 'vinted-size-filter-title';
    title.textContent = t('filterTitle');
    container.appendChild(title);

    const list = document.createElement('div');
    list.className = 'vinted-size-filter-checkboxes';

    sizeCheckboxes = new Map();
    uniqueSizes.forEach(size => {
      const label = document.createElement('label');
      label.className = 'vinted-size-filter-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'vinted-size-filter-checkbox';
      checkbox.value = size;
      checkbox.checked = checkedStates.has(size) ? checkedStates.get(size) : true;
      checkbox.addEventListener('change', () => {
        checkedStates.set(size, checkbox.checked);
        applyFilter();
      });

      // Size labels come from Vinted's own listing data, not from us.
      const span = document.createElement('span');
      span.textContent = size;

      label.appendChild(checkbox);
      label.appendChild(span);
      list.appendChild(label);
      sizeCheckboxes.set(size, checkbox);
    });

    container.appendChild(list);
    return container;
  }

  function applyFilter() {
    const checked = new Set();
    sizeCheckboxes.forEach((cb, size) => { if (cb.checked) checked.add(size); });
    itemsMap.forEach((sizes, el) => {
      el.style.display = sizes.some(s => checked.has(s)) ? '' : 'none';
    });
  }

  function removeFilter() {
    document.querySelectorAll('[' + FILTER_ATTR + ']').forEach(el => el.remove());
    filterContainer = null;
    anchor = null;
    itemsMap.forEach((_, el) => { el.style.display = ''; });
    itemsMap = new Map();
  }

  /**
   * Creates or refreshes the filter. Returns true when the filter is in place.
   */
  function sync() {
    const section = findSection();
    if (!section) {
      if (filterContainer) removeFilter();
      return false;
    }

    if (!isReadyToInsert()) return false;

    const uniqueSizes = extractSizes(section);
    if (uniqueSizes.length === 0) return false;

    const sizesKey = uniqueSizes.join('\u0000');
    const needsRebuild =
      !filterContainer ||
      !filterContainer.isConnected ||
      anchor !== section.anchor ||
      filterContainer.dataset.sizes !== sizesKey;

    if (needsRebuild) {
      document.querySelectorAll('[' + FILTER_ATTR + ']').forEach(el => el.remove());
      filterContainer = buildFilter(uniqueSizes);
      filterContainer.dataset.sizes = sizesKey;
      anchor = section.anchor;
      anchor.parentElement.insertBefore(filterContainer, anchor);
    }

    applyFilter();
    return true;
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        checkedStates = new Map();
        removeFilter();
      }
      sync();
    }, SYNC_DEBOUNCE_MS);
  }

  document.addEventListener(HYDRATED_EVENT, () => {
    if (pageHydrated) return;
    pageHydrated = true;
    scheduleSync();
  });

  // Permanent observer: new items (infinite scroll), React re-renders and
  // client-side navigation. Mutations inside our own filter are ignored.
  new MutationObserver(mutations => {
    for (const m of mutations) {
      if (filterContainer && filterContainer.contains(m.target)) continue;
      scheduleSync();
      return;
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', scheduleSync);

  // Safety net while the page settles; also drives the hydration fallback.
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    const ok = sync();
    if ((ok && tries > 3) || tries > 60) clearInterval(poll);
  }, 500);

  // Ask the probe whether hydration already happened before we started.
  document.dispatchEvent(new CustomEvent(PING_EVENT));
  scheduleSync();
})();
