# Extension Chrome Vinted - Filtrage par taille

Extension Chrome qui permet de filtrer les articles par taille sur Vinted, à la fois sur les pages de produits (section "Dressing du membre") et sur les pages de profil membre.

## Fonctionnalités

- 🎯 Détection automatique de la section "Dressing du membre" (pages produits)
- 👤 Support des pages de profil membre (filtrage des annonces)
- ✅ Interface de filtrage avec checkboxes pour chaque taille unique
- 🔍 Filtrage en temps réel des articles selon les tailles sélectionnées
- 🔄 Support du scroll infini (chargement dynamique des articles)
- 🎨 Design intégré au style Vinted

## Installation

1. Clonez ou téléchargez ce dépôt
2. Ouvrez Chrome et allez dans `chrome://extensions/`
3. Activez le "Mode développeur" (en haut à droite)
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier contenant les fichiers de l'extension

## Utilisation

### Sur une page de produit
1. Visitez une page de produit sur Vinted (ex: `https://www.vinted.fr/items/...`)
2. Descendez jusqu'à la section "Dressing du membre"
3. Une interface de filtrage apparaît automatiquement juste après le titre
4. Cochez/décochez les tailles pour afficher ou masquer les articles correspondants

### Sur une page de profil membre
1. Visitez une page de profil membre (ex: `https://www.vinted.fr/member/...`)
2. Naviguez vers l'onglet "Annonces" si nécessaire
3. Une interface de filtrage apparaît automatiquement en haut de la liste d'articles
4. Cochez/décochez les tailles pour filtrer les articles

**Note:** Toutes les tailles sont cochées par défaut (tous les articles visibles)

## Format des tailles

L'extension détecte les tailles depuis le format Vinted :
- Format: `W31 | FR 40 · Très bon état`
- L'extension considère tout ce qui précède " · " comme une taille unique
- Les tailles multiples (ex: "W31 | FR 40") sont traitées comme une seule taille

## Structure des fichiers

```
VintedExtension/
├── manifest.json    # Configuration de l'extension (Manifest V3)
├── content.js      # Script principal d'injection
├── styles.css      # Styles pour l'interface de filtrage
└── README.md       # Documentation
```

## Notes techniques

- L'extension utilise `data-testid` pour cibler les éléments (plus stable que les classes CSS)
- Un `MutationObserver` détecte les changements dynamiques dans le DOM
- Compatible avec le chargement infini des articles (scroll)
- Respecte le design et les couleurs de Vinted

## Développement

### Prérequis
- Chrome/Chromium (dernière version)
- Mode développeur activé

### Test
1. Chargez l'extension en mode développeur
2. Visitez différentes pages de produits Vinted avec des articles de différentes tailles
3. Testez le filtrage avec plusieurs combinaisons de tailles
4. Vérifiez que le scroll infini fonctionne correctement

## Licence

MIT
