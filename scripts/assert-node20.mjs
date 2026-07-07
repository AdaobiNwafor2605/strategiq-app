const major = Number(process.version.match(/^v(\d+)/)?.[1] ?? 0);
if (major < 20) {
  console.error(
    `\nNode.js 20+ is required (current: ${process.version}). Vite 6 breaks on older Node with:\n` +
      '  TypeError: crypto$2.getRandomValues is not a function\n\n' +
      'Fix (nvm):  nvm install 20 && nvm use\n' +
      'This repo includes .nvmrc with "20".\n'
  );
  process.exit(1);
}
