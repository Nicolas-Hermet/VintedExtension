// Configuration for Mozilla's web-ext tool (npx web-ext lint|run|build).
module.exports = {
  ignoreFiles: [
    'CLAUDE.md',
    'README.md',
    'LICENSE',
    'web-ext-config.cjs',
  ],
  build: {
    overwriteDest: true,
  },
};
