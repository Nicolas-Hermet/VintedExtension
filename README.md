# Vinted size filter

Browser extension for **Chrome** and **Firefox** that lets you filter items by size on Vinted, both on item pages ("Dressing du membre" section) and on member profile pages.

## Features

- Detects the "Dressing du membre" section on item pages
- Supports member profile pages
- One checkbox per size found in the listed items, all checked by default
- Filters items instantly as you check or uncheck sizes
- Follows infinite scroll: new sizes are added and your choices are kept
- Survives Vinted's React hydration and client-side navigation

## Installation

### Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked**.
3. Select the repository folder.

After a code change, click the extension's reload button, then reload the Vinted tab.

Chrome reports an "Unrecognized manifest key 'browser_specific_settings'" warning. It is harmless: that key is only used by Firefox.

### Firefox (140 or later)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` at the repository root.

After a code change, click **Reload** under the extension, then reload the Vinted tab.

Temporary add-ons are removed when Firefox closes. A permanent install requires a Mozilla-signed build (see [Packaging](#packaging)).

## Usage

1. Open an item page (`https://www.vinted.fr/items/...`) and scroll to "Dressing du membre", or open a member profile (`https://www.vinted.fr/member/...`).
2. The size filter appears above the item grid.
3. Check or uncheck sizes to show or hide the matching items.

## How sizes are detected

Sizes are read from each item's subtitle, e.g. `W31 | FR 40 · Très bon état`. Everything before ` · ` is treated as a single size, so `W31 | FR 40` is one size.

## Project structure

```
VintedExtension/
├── manifest.json          # Manifest V3, shared by Chrome and Firefox
├── content.js             # Builds the filter (isolated world)
├── hydration-probe.js     # Detects React hydration (page's MAIN world)
├── styles.css             # Filter styles
├── _locales/fr/           # User-facing strings (French only for now)
└── web-ext-config.cjs     # Settings for Mozilla's web-ext tool
```

## Technical notes

- Vinted is a server-side rendered React app. Anything inserted before React hydrates the page is wiped out, so `content.js` waits for `hydration-probe.js` to report hydration through DOM events. If the probe never answers, the filter is inserted after a short delay.
- The probe runs in the page's `MAIN` world because React's internal `__reactFiber` properties are invisible from the isolated world. The filter itself runs in the isolated world so it can use the `i18n` API.
- Vinted's CSS class names are hashed, so elements are selected with `data-testid` attributes only.
- A permanent `MutationObserver` re-inserts the filter if Vinted re-renders the grid and picks up items loaded by infinite scroll.

## Development

All user-facing text lives in `_locales/<lang>/messages.json`. French is currently the only locale.

```sh
npx web-ext lint    # Validate the extension against Firefox rules
npx web-ext run     # Launch Firefox with the extension loaded
```

## Packaging

```sh
npx web-ext build   # Creates web-ext-artifacts/<name>-<version>.zip
```

The zip can be uploaded to [addons.mozilla.org](https://addons.mozilla.org/developers/) for signing (listed or unlisted), and to the Chrome Web Store.

## License

MIT
