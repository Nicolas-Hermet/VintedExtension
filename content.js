// Extension Vinted - Filtrage par taille
// Détecte la section "Dressing du membre" et ajoute un filtre par taille

(function() {
  'use strict';

  // État de l'extension
  let filterContainer = null;
  let itemsMap = new Map(); // Map: element DOM -> taille(s)
  let sizeCheckboxes = new Map(); // Map: taille -> checkbox element
  let observer = null;
  let globalObserver = null;
  let isInitialized = false;

  /**
   * Détecte si on est sur une page de profil membre
   */
  function isMemberPage() {
    return window.location.pathname.match(/^\/member\/\d+/);
  }

  /**
   * Trouve la section appropriée (Dressing du membre ou Annonces sur profil)
   */
  function findDressingSection() {
    // Détecter le type de page
    const isMember = isMemberPage();

    if (isMember) {
      // Sur une page de profil membre, chercher le conteneur feed-grid
      const feedGrid = document.querySelector('.feed-grid');

      if (feedGrid) {
        // Chercher un titre h2 qui indique le nombre d'articles
        let heading = feedGrid.previousElementSibling;

        // Remonter pour trouver un h2 avec "articles" dans le texte
        let current = feedGrid.parentElement;
        while (current && current !== document.body) {
          const h2 = current.querySelector('h2');
          if (h2 && h2.textContent.match(/\d+\s+articles?/i)) {
            heading = h2;
            break;
          }
          current = current.parentElement;
        }

        // Si pas de heading trouvé, créer un virtuel
        if (!heading || !heading.textContent.match(/\d+\s+articles?/i)) {
          heading = document.createElement('div');
          heading.style.display = 'none';
          feedGrid.parentElement.insertBefore(heading, feedGrid);
        }

        return {
          heading: heading,
          container: feedGrid.parentElement || feedGrid
        };
      }

      // Fallback : chercher par data-testid
      const firstGridItem = document.querySelector('[data-testid="grid-item"]');
      if (firstGridItem) {
        const feedGrid = firstGridItem.closest('.feed-grid') || firstGridItem.parentElement;
        if (feedGrid) {
          const heading = document.createElement('div');
          heading.style.display = 'none';
          feedGrid.parentElement.insertBefore(heading, feedGrid);

          return {
            heading: heading,
            container: feedGrid.parentElement || feedGrid
          };
        }
      }
    } else {
      // Sur une page de produit, chercher "Dressing du membre"
      const headings = Array.from(document.querySelectorAll('h2, h3'));
      const dressingHeading = headings.find(h =>
        h.textContent.includes('Dressing du membre')
      );

      if (dressingHeading) {
        // Trouver le conteneur parent qui contient la liste d'articles
        let container = dressingHeading.parentElement;

        // Remonter jusqu'à trouver un conteneur avec des articles
        while (container && container.querySelector('[data-testid*="other_user_items"]') === null) {
          container = container.parentElement;
          if (!container || container === document.body) break;
        }

        if (container) {
          return {
            heading: dressingHeading,
            container: container
          };
        }
      }
    }

    return null;
  }

  /**
   * Extrait la taille depuis le texte du subtitle
   * Format attendu: "W31 | FR 40 · Très bon état"
   * Retourne: "W31 | FR 40" (tout avant " · ")
   */
  function extractSize(subtitleText) {
    if (!subtitleText) return null;

    const parts = subtitleText.split(' · ');
    if (parts.length === 0) return null;

    const sizePart = parts[0].trim();
    return sizePart || null;
  }

  /**
   * Trouve tous les articles dans la section
   */
  function findItems() {
    const isMember = isMemberPage();

    if (isMember) {
      // Sur une page de profil, utiliser data-testid="grid-item"
      const gridItems = Array.from(document.querySelectorAll('[data-testid="grid-item"]'));
      return gridItems;
    } else {
      // Sur une page de produit, utiliser les data-testid
      const items = Array.from(document.querySelectorAll('[data-testid*="other_user_items"]'));
      return items.filter(item => {
        const link = item.closest('a[href*="/items/"]') || item.querySelector('a[href*="/items/"]');
        return link !== null;
      });
    }
  }

  /**
   * Trouve le conteneur DOM approprié pour un article (pour masquage/affichage)
   */
  function findItemContainer(item) {
    // Essayer différentes stratégies pour trouver le bon conteneur
    // 1. Chercher un élément li parent
    let container = item.closest('li');
    if (container) return container;

    // 2. Chercher un conteneur avec une structure spécifique Vinted
    container = item.closest('[class*="item-box"]') || item.closest('[class*="new-item-box"]');
    if (container) return container;

    // 3. Remonter jusqu'à trouver un div parent qui contient le lien
    const link = item.querySelector('a[href*="/items/"]') || item.closest('a[href*="/items/"]');
    if (link) {
      container = link.closest('div[class*="item"]') || link.parentElement;
      if (container) return container;
    }

    // 4. Fallback: parent direct ou parent du parent
    return item.parentElement || item;
  }

  /**
   * Extrait les tailles de tous les articles et les mappe
   */
  function extractSizesFromItems() {
    itemsMap.clear();
    const sizesSet = new Set();
    const isMember = isMemberPage();

    const items = findItems();

    items.forEach(item => {
      // Trouver l'élément subtitle qui contient la taille
      // Sur les pages de profil: data-testid="product-item-id-XXXXX--description-subtitle"
      // Sur les pages produit: data-testid*="--description-subtitle"
      let subtitle = item.querySelector('[data-testid*="--description-subtitle"]');

      if (subtitle) {
        const size = extractSize(subtitle.textContent);
        if (size) {
          // Sur les pages de profil, item (grid-item) est le conteneur à masquer/afficher
          // Sur les pages produit, il faut trouver le conteneur
          const itemContainer = isMember ? item : findItemContainer(item);

          // Stocker la correspondance
          if (!itemsMap.has(itemContainer)) {
            itemsMap.set(itemContainer, []);
          }
          itemsMap.get(itemContainer).push(size);
          sizesSet.add(size);
        }
      }
    });

    return Array.from(sizesSet).sort();
  }

  /**
   * Crée l'interface de filtrage avec les checkboxes
   */
  function createFilterInterface(uniqueSizes) {
    // Supprimer l'ancienne interface si elle existe
    if (filterContainer && filterContainer.parentNode) {
      filterContainer.remove();
    }

    // Créer le conteneur principal
    filterContainer = document.createElement('div');
    filterContainer.className = 'vinted-size-filter-container';
    filterContainer.setAttribute('data-extension', 'vinted-size-filter');

    // Créer le label/titre
    const title = document.createElement('div');
    title.className = 'vinted-size-filter-title';
    title.textContent = 'Filtrer par taille:';
    filterContainer.appendChild(title);

    // Créer le conteneur des checkboxes
    const checkboxesContainer = document.createElement('div');
    checkboxesContainer.className = 'vinted-size-filter-checkboxes';

    sizeCheckboxes.clear();

    // Créer une checkbox pour chaque taille unique
    uniqueSizes.forEach(size => {
      const label = document.createElement('label');
      label.className = 'vinted-size-filter-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'vinted-size-filter-checkbox';
      checkbox.value = size;
      checkbox.checked = true; // Toutes cochées par défaut

      const span = document.createElement('span');
      span.textContent = size;

      label.appendChild(checkbox);
      label.appendChild(span);
      checkboxesContainer.appendChild(label);

      sizeCheckboxes.set(size, checkbox);
    });

    filterContainer.appendChild(checkboxesContainer);

    return filterContainer;
  }

  /**
   * Applique le filtre aux articles selon les checkboxes cochées
   */
  function applyFilter() {
    // Récupérer les tailles cochées
    const checkedSizes = new Set();
    sizeCheckboxes.forEach((checkbox, size) => {
      if (checkbox.checked) {
        checkedSizes.add(size);
      }
    });

    // Pour chaque article, vérifier si au moins une de ses tailles est cochée
    itemsMap.forEach((sizes, itemElement) => {
      const shouldShow = sizes.some(size => checkedSizes.has(size));

      if (shouldShow) {
        itemElement.style.display = '';
      } else {
        itemElement.style.display = 'none';
      }
    });
  }

  /**
   * Initialise le système de filtrage
   */
  function initFiltering() {
    // Ne pas réinitialiser si déjà initialisé et actif
    if (isInitialized && filterContainer && filterContainer.parentNode) {
      return true;
    }

    const section = findDressingSection();

    if (!section || !section.container) {
      return false;
    }

    // Extraire les tailles
    const uniqueSizes = extractSizesFromItems();

    if (uniqueSizes.length === 0) {
      return false;
    }

    // Créer l'interface
    const filterUI = createFilterInterface(uniqueSizes);

    // Insérer le filtre
    const isVirtualHeading = section.heading.style.display === 'none' ||
                            window.getComputedStyle(section.heading).display === 'none' ||
                            section.heading.tagName === 'DIV';

    if (isVirtualHeading) {
      // Si heading virtuel, insérer avant le feed-grid ou au début du conteneur
      const feedGrid = section.container.querySelector('.feed-grid');
      if (feedGrid) {
        feedGrid.parentElement.insertBefore(filterUI, feedGrid);
      } else {
        section.container.insertBefore(filterUI, section.container.firstChild);
      }
    } else {
      // Sinon, insérer juste après le titre
      section.heading.parentNode.insertBefore(filterUI, section.heading.nextSibling);
    }

    // Ajouter les listeners sur les checkboxes
    sizeCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', applyFilter);
    });

    // Appliquer le filtre initial (tous visibles)
    applyFilter();

    isInitialized = true;
    return true;
  }

  /**
   * Réinitialise le filtrage quand de nouveaux articles sont ajoutés
   */
  function resetFiltering() {
    // Réextraire les tailles
    const uniqueSizes = extractSizesFromItems();

    if (uniqueSizes.length === 0) {
      return;
    }

    // Sauvegarder les états des checkboxes existantes
    const checkedStates = new Map();
    sizeCheckboxes.forEach((checkbox, size) => {
      if (uniqueSizes.includes(size)) {
        checkedStates.set(size, checkbox.checked);
      }
    });

    // Recréer l'interface
    const section = findDressingSection();
    if (section && section.container) {
      const filterUI = createFilterInterface(uniqueSizes);

      // Restaurer les états des checkboxes
      checkedStates.forEach((checked, size) => {
        const checkbox = sizeCheckboxes.get(size);
        if (checkbox) {
          checkbox.checked = checked;
        }
      });

      const isVirtualHeading = section.heading.style.display === 'none' ||
                              window.getComputedStyle(section.heading).display === 'none' ||
                              section.heading.tagName === 'DIV';

      if (isVirtualHeading) {
        // Si heading virtuel, insérer avant le feed-grid ou au début du conteneur
        const feedGrid = section.container.querySelector('.feed-grid');
        if (feedGrid) {
          feedGrid.parentElement.insertBefore(filterUI, feedGrid);
        } else {
          section.container.insertBefore(filterUI, section.container.firstChild);
        }
      } else {
        // Sinon, insérer juste après le titre
        section.heading.parentNode.insertBefore(filterUI, section.heading.nextSibling);
      }

      // Réajouter les listeners
      sizeCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', applyFilter);
      });

      // Réappliquer le filtre
      applyFilter();
    }
  }

  /**
   * Configure le MutationObserver pour détecter les changements
   */
  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    const section = findDressingSection();
    if (!section || !section.container) {
      return;
    }

    observer = new MutationObserver((mutations) => {
      let shouldReset = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const isMember = isMemberPage();

              if (isMember) {
                // Sur les pages de profil, détecter les grid-item
                if (node.getAttribute && node.getAttribute('data-testid') === 'grid-item') {
                  shouldReset = true;
                }
                if (node.querySelector && node.querySelector('[data-testid="grid-item"]')) {
                  shouldReset = true;
                }
              } else {
                // Sur les pages produit, détecter les other_user_items
                if (node.querySelector && node.querySelector('[data-testid*="other_user_items"]')) {
                  shouldReset = true;
                }
                if (node.getAttribute && node.getAttribute('data-testid') && node.getAttribute('data-testid').includes('other_user_items')) {
                  shouldReset = true;
                }
              }
            }
          });
        }
      });

      if (shouldReset) {
        // Délai pour laisser le DOM se stabiliser
        setTimeout(() => {
          resetFiltering();
        }, 200);
      }
    });

    observer.observe(section.container, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Observer global pour détecter quand les articles sont chargés
   */
  function setupGlobalObserver() {
    if (globalObserver) {
      globalObserver.disconnect();
    }

    // Observer le document entier pour détecter quand les articles apparaissent
    globalObserver = new MutationObserver((mutations) => {
      // Vérifier si des articles sont maintenant présents
      const isMember = isMemberPage();
      let hasItems = false;

      if (isMember) {
        // Sur les pages de profil, chercher grid-item
        hasItems = document.querySelector('[data-testid="grid-item"]') !== null;
      } else {
        // Sur les pages produit, chercher other_user_items
        hasItems = document.querySelector('[data-testid*="other_user_items"]') !== null;
      }

      if (hasItems && !isInitialized) {
        // Attendre un peu pour que le DOM se stabilise
        setTimeout(() => {
          if (initFiltering()) {
            setupObserver();
            if (globalObserver) {
              globalObserver.disconnect();
              globalObserver = null;
            }
          }
        }, 500);
      }
    });

    globalObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Fonction principale d'initialisation
   */
  function init() {
    // Essayer d'initialiser immédiatement
    if (initFiltering()) {
      setupObserver();
      return;
    }

    // Si ça ne fonctionne pas, mettre en place un observer global
    setupGlobalObserver();

    // Réessayer périodiquement
    let retryCount = 0;
    const maxRetries = 30; // Augmenter à 30 tentatives (30 secondes)
    const retryInterval = setInterval(() => {
      if (isInitialized && filterContainer && filterContainer.parentNode) {
        clearInterval(retryInterval);
        if (globalObserver) {
          globalObserver.disconnect();
          globalObserver = null;
        }
        return;
      }

      retryCount++;
      if (retryCount >= maxRetries) {
        clearInterval(retryInterval);
        if (globalObserver) {
          globalObserver.disconnect();
          globalObserver = null;
        }
        return;
      }

      if (initFiltering()) {
        clearInterval(retryInterval);
        setupObserver();
        if (globalObserver) {
          globalObserver.disconnect();
          globalObserver = null;
        }
      }
    }, 1000);
  }

  // Démarrer l'extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Attendre un peu même si le DOM est prêt (pour les SPA)
    setTimeout(init, 300);
  }

  // Écouter les changements d'URL (pour les SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      isInitialized = false;
      if (filterContainer) {
        filterContainer.remove();
        filterContainer = null;
      }
      if (observer) {
        observer.disconnect();
      }
      if (globalObserver) {
        globalObserver.disconnect();
        globalObserver = null;
      }
      setTimeout(init, 500);
    }
  }).observe(document, { subtree: true, childList: true });

})();
