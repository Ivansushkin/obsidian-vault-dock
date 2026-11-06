# Vault Switcher Bar development

## Communication and code quality

- Communicate with the user in Russian. Keep this file in English.
- Read the applicable documentation before editing. Start with
  [development notes](docs/development.md) for desktop compatibility findings
  and manual acceptance scenarios.
- Do not use emoji. Use braces for all control-flow bodies, including single
  statements. Use ESLint for code rules and Prettier for formatting.
- Write concise English JSDoc for non-trivial functions and classes. Avoid
  comments that restate the code and deeply nested control flow.
- Reuse existing modules and domain models. Introduce shared abstractions only
  when at least two independent callers need them.

## Project and tooling

- Use Node 22 and npm. Bundle TypeScript in `src/` with esbuild.
- Keep `src/main.ts` as the composition root for the Obsidian plugin. Register
  and dispose of UI, listeners, and timers through the plugin lifecycle. Keep
  domain logic in focused modules.
- `npm run build` writes `main.js`, `manifest.json`, and `styles.css` to
  `build/`. Configure an optional installation destination by copying
  `.env.example` to `.env` and setting `VAULT_SWITCHER_PLUGIN_PATH` to the
  absolute path of the plugin directory in an explicit test vault. Build and
  watch read the ignored file. `--vault` overrides it. Tests and CI skip the
  `.env` destination.
- Run `npm run check` and `git diff --check` before handing off changes.
  Apply lint or format fixes to the affected files and preserve unrelated
  edits. Keep the Husky pre-commit hook enabled.
- Keep generated build output, dependencies, `.env`, and local plugin data
  out of Git. Keep `manifest.json.id` stable. On version bumps, keep
  `manifest.json`, `package.json`, and `package-lock.json` in sync.

## Git workflow

- Before editing, check the active branch, worktree status, and upstream.
  Preserve unrelated changes and respect the user's checkout instructions.
- Work on the active branch by default. Create or switch branches only with
  the user's explicit permission.
- When the user authorizes a new branch, base it on the latest available
  `origin/main` and use the `codex/` prefix unless the user specifies otherwise.
  Set the upstream to the branch's own remote branch when publishing.
- Create, amend, or rewrite commits only with the user's explicit permission.
  Push or publish only when the user explicitly requests it.

## Obsidian and security

- Keep the stock vault picker and bottom sidebar controls intact. Scope styles
  to the plugin's own elements.
- Use the registered vault ID for identity. Vault labels can be duplicated.
- Prefer public Obsidian APIs. Keep Electron and undocumented Obsidian calls
  in a focused desktop module. Before changing them, verify the target build
  and read the [project skill](.agents/skills/obsidian-vault-switcher-dev/SKILL.md).
- Store only data owned by this plugin. Do not execute remote code or add
  telemetry. Do not read or log local `.env` files, secrets, private file
  contents, or plugin data during agent work. Use sanitized fixtures and
  suppress potentially sensitive build output before it enters tool results.

## Documentation and testing

- Keep `README.md` focused on stable product behavior and essential setup.
  Put implementation findings and acceptance scenarios in `docs/`. Read
  version and compatibility metadata from `manifest.json` when needed.
- Before adding a test, identify the concrete failure it detects and check
  for coverage at the same boundary. Prefer small fixtures and observable
  outcomes. Avoid large UI mocks, tests of trivial wrappers, and tests
  added solely to increase coverage. Use focused functional checks when
  they better exercise the user scenario.
- Verify changes to the vault registry, panel, shared settings, or window
  handoff in the target Obsidian build with two test vaults. Cover the relevant
  failure paths and state which scenarios were exercised. Use the live run as
  evidence for runtime behavior.
