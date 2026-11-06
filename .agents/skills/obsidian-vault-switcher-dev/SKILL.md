---
name: obsidian-vault-switcher-dev
description: Use when changing or debugging vault discovery, the upper sidebar bar, shared tile images, or desktop window handoff in Vault Switcher Bar.
---

# Vault Switcher Bar development

Read [development notes](../../../docs/development.md) for the prototype's
versioned findings and the two-vault acceptance cases.

- Confirm the installed Obsidian version before relying on internal IPC,
  Electron window globals or sidebar selectors. Keep this compatibility code
  separate from rendering and cover the missing-capability path.
- Use Obsidian's registered vault identity for active state, images and
  routing. Two registered paths may have the same display name.
- Separate accepting an open request from rendering its destination. For a
  handoff, apply bounds in the target and match the ready acknowledgment to
  the active request before closing the source. Exercise failure and timeout.
- Keep shared images in app-local state. Verify the storage scope and
  cross-window updates with two vaults. Store only data owned by this plugin.
- Run `npm run check` for the toolchain. For UI, IPC or window behavior,
  verify the affected scenario in a real Obsidian build with two test vaults
  and report which parts were exercised.
