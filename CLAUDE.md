# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Languages

- **Talk to the user in French only.** Every message addressed to the maintainer (chat replies, questions, summaries) is written in French.
- **Everything that lives in the repository or on GitHub is written in English.** This covers code comments, identifiers, commit messages, branch names, README and other docs, pull request titles and descriptions, PR comments and code reviews.

## User-facing text must be internationalized

- Never hardcode a string that the end user can see (labels, titles, tooltips, `aria-*` text, extension name and description).
- Add every such string to `_locales/<lang>/messages.json` and read it with `i18n.getMessage()` in scripts, or `__MSG_<key>__` in `manifest.json`.
- French (`fr`) is currently the only locale and the `default_locale`. When adding a key, add it to every locale folder that exists.
- Scripts running in the page's `MAIN` world cannot access extension APIs, so they must not render user-facing text.

## Project layout

- One codebase serves both Chrome and Firefox. Browser-specific behaviour should stay in `manifest.json` keys whenever possible rather than forking the scripts.
- `content.js` runs in the isolated world: it finds the item grid, builds the size filter and hides items.
- `hydration-probe.js` runs in the page's `MAIN` world: it only detects when React has hydrated the page and signals it to `content.js` through DOM events.
- Vinted's CSS class names are hashed and change between deployments. Select elements with `data-testid` attributes only.

## Testing

- Chrome: load the repository folder as an unpacked extension from `chrome://extensions`.
- Firefox: run `npx web-ext run` from the repository root, or load `manifest.json` from `about:debugging#/runtime/this-firefox`.
- Lint the Firefox build with `npx web-ext lint`.
