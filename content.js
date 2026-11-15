// Extension Vinted - Filtrage par taille
// Détecte la grille d'articles (profil membre ou "Dressing du membre" sur une
// page produit) et ajoute un filtre par taille au-dessus.
//
// Vinted est une application React rendue côté serveur. Si l'on insère le
// filtre dans le DOM avant que React n'ait fini d'« hydrater » la page, React
// détecte un décalage et re-rend le sous-arbre : le filtre apparaît quelques
// dixièmes de seconde puis disparaît. On attend donc l'hydratation, et on
// surveille en permanence que le filtre est toujours attaché pour le
// ré-insérer si Vinted re-rend la grille.

(function() {
  'use strict';

  const ATTR = 'data-vinted-size-filter';

  let filterContainer = null;
  let itemsMap = new Map();       // conteneur DOM d'un article -> tailles
  let sizeCheckboxes = new Map(); // taille -> checkbox
  let checkedStates = new Map();  // taille -> coché ? (persiste entre re-rendus)
  let anchor = null;              // élément devant lequel le filtre est inséré
  let lastUrl = location.href;
  let scheduled = null;
  let itemsFirstSeenAt = 0;       // date à laquelle des articles ont été vus pour la 1re fois
  const HYDRATION_FALLBACK_MS = 2500;

  function isMemberPage() {
    return /^\/member\/\d+/.test(location.pathname);
  }

  /**
   * Retourne la liste des articles et l'élément devant lequel insérer le filtre.
   * Les classes CSS de Vinted sont hashées (ex: "HmDNda_feed-grid"), on se
   * base donc uniquement sur les attributs data-testid.
   */
  function findSection() {
    if (isMemberPage()) {
      const items = Array.from(document.querySelectorAll('[data-testid="grid-item"]'));
      if (items.length === 0) return null;
      const grid = items[0].parentElement; // la grille (classe *_feed-grid)
      if (!grid || !grid.parentElement) return null;
      return { items, anchor: grid, containers: items };
    }

    // Page produit : section "Dressing du membre"
    const plugin = document.querySelector('[data-testid="item-page-other_user_items-plugin"]');
    if (!plugin) return null;
    const items = Array.from(plugin.querySelectorAll('[data-testid^="other_user_items-"]'))
      .filter(el => /^other_user_items-\d+$/.test(el.getAttribute('data-testid')));
    if (items.length === 0) return null;
    // Le conteneur à masquer est la cellule de grille qui enveloppe l'article
    const containers = items.map(item => {
      const cell = item.parentElement;
      return cell && cell.parentElement && cell.parentElement.getAttribute('data-testid') === 'item-view-items'
        ? cell
        : item;
    });
    return { items, anchor: plugin, containers };
  }

  /**
   * Vrai quand React a hydraté l'élément (il porte alors une clé __reactFiber$xxx).
   * Ces propriétés ne sont visibles que depuis le monde principal de la page,
   * d'où "world": "MAIN" dans le manifest. Par sécurité, si on ne les voit
   * toujours pas après un délai, on considère la page hydratée.
   */
  function isHydrated(el) {
    if (Object.keys(el).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'))) {
      return true;
    }
    if (!itemsFirstSeenAt) itemsFirstSeenAt = Date.now();
    return Date.now() - itemsFirstSeenAt > HYDRATION_FALLBACK_MS;
  }

  /**
   * Format attendu: "W31 | FR 40 · Très bon état" -> "W31 | FR 40"
   */
  function extractSize(text) {
    if (!text) return null;
    const size = text.split(' · ')[0].trim();
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
    container.setAttribute(ATTR, '');
    container.setAttribute('data-extension', 'vinted-size-filter');

    const title = document.createElement('div');
    title.className = 'vinted-size-filter-title';
    title.textContent = 'Filtrer par taille:';
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
    document.querySelectorAll('[' + ATTR + ']').forEach(el => el.remove());
    filterContainer = null;
    anchor = null;
    itemsMap.forEach((_, el) => { el.style.display = ''; });
    itemsMap = new Map();
  }

  /**
   * Crée ou met à jour le filtre. Retourne true si le filtre est en place.
   */
  function sync() {
    const section = findSection();
    if (!section) {
      if (filterContainer) removeFilter();
      return false;
    }

    // Ne rien insérer avant l'hydratation React, sinon le filtre est effacé.
    if (!isHydrated(section.items[0])) return false;

    const uniqueSizes = extractSizes(section);
    if (uniqueSizes.length === 0) return false;

    const sizesKey = uniqueSizes.join('\u0000');
    const needsRebuild =
      !filterContainer ||
      !filterContainer.isConnected ||
      anchor !== section.anchor ||
      filterContainer.dataset.sizes !== sizesKey;

    if (needsRebuild) {
      document.querySelectorAll('[' + ATTR + ']').forEach(el => el.remove());
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
        itemsFirstSeenAt = 0;
        removeFilter();
      }
      sync();
    }, 150);
  }

  // Observer permanent : nouveaux articles, re-rendu React, navigation SPA.
  new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.target === filterContainer || (filterContainer && filterContainer.contains(m.target))) continue;
      scheduleSync();
      return;
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', scheduleSync);

  // Filet de sécurité pendant les premières secondes (hydratation tardive).
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    const ok = sync();
    if ((ok && tries > 3) || tries > 60) clearInterval(poll);
  }, 500);

  scheduleSync();
})();
