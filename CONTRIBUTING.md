# Contributing to Px to Tailwind Plus

Thanks for your interest in improving the extension!

## Architecture

- `src/core/` — the **pure converter**. Zero `vscode` imports, fully unit-tested
  with Vitest. Adding a supported property is usually a one-line change in
  `src/core/categories.ts`.
- `src/` — the VS Code layer: settings, change handler, class-context detection,
  theme readers, hover, status bar, commands.
- `test/` — all Vitest tests.

## Development

```bash
npm install
npm run watch     # esbuild watch; press F5 in VS Code to launch the Extension Host
npm test          # run unit tests
npm run check     # TypeScript type-check (strict)
npm run lint      # ESLint (flat config)
npm run package   # produce a .vsix
```

Runs on Node 24 (see `.nvmrc`). The extension bundle targets Node 18 for
Extension Host compatibility.

## Guidelines

- Keep `src/core/` free of `vscode` imports so it stays unit-testable.
- Add or update tests for any behavior change; keep converter coverage complete.
- Use clear, descriptive names — no single-letter variables.
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`, …).

## Releasing

Maintainers cut releases with `npm run release -- <patch|minor|major>`, which
bumps the version, updates the changelog, tags `vX.Y.Z` and pushes. The tag
triggers the release workflow, which publishes to the VS Code Marketplace and
Open VSX. See the README for the required `VSCE_PAT` and `OVSX_TOKEN` secrets.
