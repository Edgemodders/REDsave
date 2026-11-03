# REDsave: notes for Claude sessions

REDsave is a save game manager for Cyberpunk 2077 (PC), built as a VS Code extension (`edgemodders.redsave`). It finds saves by their metadata (search and filters), keeps sets of saves (loadouts) outside the game's save folder and swaps them in, and gives saves titles of their own. Read [docs/design.md](docs/design.md) before any feature work: it has what a save folder and its metadata hold (checked on the dev PC), the search and filters, the library layout, the swap rules, the titles spike, the phases S0 to S4 and the open questions.

It is one of the Edgemodders repos, checked out side by side in `E:\Modding\Cyberpunk 2077\`. REDnode's `CLAUDE.md` and `docs/dev-setup.md` (`../REDnode`) set the shared conventions. The closest siblings are EDGEdeck (`../EDGEdeck`, the mod manager: library, deploy, Nexus, an extension API) and EDGEwave (`../EDGEwave`, the scaffold this repo was copied from).

## Current status and next step

- **Asked for by the owner on 2026-11-03:** the repo with the release workflow, scaffolding and brand; then, the same day, searching and filtering saves by title, date, lifepath and any other useful metadata in the save files (V's gender, for example). Both are in the design.
- **S0 done (2026-11-03), REDsave 0.0.1, not released:** the extension skeleton (`src/saves.ts` reads the save folder, `src/extension.ts` counts saves by kind in the Saves view), 4 unit tests, the Check, Release, Docs site and Verify publish tokens workflows, the brand (`tools/brand/`), the Nexus page source (`nexus/`, no page yet), the docs site and the design (draft 1).
- **Next: agree S1 Find with the owner** (design, "Find (S1)" and "Open questions"), then build it. Asked for by the owner on 2026-11-03 for S2: filter the saves, select the results and add them all to a loadout (design, "Adding saves to a loadout"; S1's page needs multi-select with Select all for it). Decided the same day: saves are only moved, no Copy for now; copies by hard link are a research item (design, "Later: copies by hard link"). Stop after each phase for the owner's hand test.
- **Found on 2026-11-03 on the dev PC** (game 2.5): 993 save folders (962 manual, 20 auto, 10 quick, 1 point of no return), 970 of them saves (23 are empty folders the game left, not counted: a save needs `sav.dat`) in `C:\Users\VYRAL\Saved Games\CD Projekt Red\Cyberpunk 2077`, each with `sav.dat` (about 5.7 MB), `metadata.9.json` (about 6 KB) and `screenshot.png`; the folder has `steam_autocloud.vdf`, so Steam Cloud syncs it. The metadata's fields are in the design's table. REDcode's `loc_get` (REDbridge) resolved `LocKey#98600` "Clampdown", `LocKey#9860` "Nocturne Op55N1", `LocKey#10963` "Little China".
- **Unverified, to settle in their phases:** the first index pass's time; `timestampString`'s day and month order across locales; whether a folder renumbered on copy needs the metadata's `name` changed; what Steam Cloud does with a swap (S2's test); whether the load menu reads `metadata.9.json` or `sav.dat`, and so whether titles can be shown in the game without a script mod (S3a).
- `../SaveTags` holds an earlier redscript experiment (January 2026) that adds a name to the save menu and shows it in the load list. Its origin and licence are unknown (it calls a `NamedSavesEnv` it does not define): use it only as a hint of where the game draws the lists, and ask the owner before reusing any of it.
- **Open on GitHub, for the owner:** the repo's social preview (upload `docs/assets/brand/social.png` in Settings > General); whether the organisation secrets `VSCE_PAT`, `OVSX_PAT` and `NEXUS_KEY` reach this repo (a session cannot list them: the token lacks `admin:org`); the Nexus page, made by hand before the first release.

## Safety: the player's saves

- Saves are the player's own work and cannot be made again. Never write to, move or delete anything in the real save folder from a session, except through REDsave's own tested code run by the owner. Checks and spikes run on a copy of the folder (`redsave.savesPath` pointed at it).
- Only save folders (`ManualSave-<n>`, `AutoSave-<n>`, `QuickSave-<n>`, `PointOfNoReturnSave-<n>`, `EndGameSave-<n>`) are REDsave's to move. `user.gls`, `EnabledMods.json`, `HDRUserSettings.json` and `steam_autocloud.vdf` are the game's and Steam's: never touched.
- Any swap or write follows the design's swap rules (game not running, nothing deleted, a journal, undo). A change to them gets the whole list checked again.
- Never commit saves, their metadata or pictures, or names read from the game (they are game data); `.gitignore` covers save folders.

## Conventions

The same as REDnode's:

- **Commits:** commit straight to `main` and push, in small logical commits. Agree the plan in chat first. Use a PR only for large or risky changes, and ask before opening one. End commit messages with the attribution line the session's instructions give.
- **Git identity:** set per repo to `CyberbuildsAI` with the GitHub no-reply email (docs/dev-setup.md). The global identity on the dev PC is another one: never change it.
- **Versions:** one version, in `package.json`. Raise it with each hand test build, and refer to it as "REDsave <version>".
- **Release gate (the owner's rule):** no release (the Release workflow with Make a release, a Marketplace, Open VSX or Nexus upload) until every hand test of the changes since the last release has passed (docs/testing.md). Check this and say what is still open before a release run, even when asked to release.
- **Releases:** start a release run (`gh workflow run release.yml -f release=true`, with `-f nexus=true` for Nexus) only when the owner asks in chat. The workflow is described at the top of `.github/workflows/release.yml`; it stops before building on a missing CHANGELOG section, a README that does not name the version, or a Nexus description edited on Nexus since the last pull.
- **README at each release (the owner's rule, 2026-11-03; the same in every Edgemodders repo):** before a release run, update README.md's status line (`**Status: <version> released on <date>** ...`) and draw the status badge again (the `status` entry in `tools/brand/badges.py`, then `python -I tools/brand/badges.py docs/assets/brand/badges`; the README's `<img alt>` too). `tools/release/readme-check.mjs` checks it. Between releases, keep the status line and the badge current with the phase.
- **Changelog (the owner's rule, the same in every Edgemodders repo):** `CHANGELOG.md` at the root (for the stores; the docs site shows it as changelog.html), a section per release, newest first, with **Unreleased** on top. With each change a player would notice, add a line under **Unreleased** in the same commit, grouped **New**, **Changed**, **Fixed**, **Other** (bold lines, as `tools/release-notes.mjs` reads them); leave out test-only changes. Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty one.
- **Shared files, copied as they are:** `tools/nexus/nexus.mjs` and `api.mjs`, and `tools/release/readme-check.mjs`, are REDnode's. Change them in REDnode, then copy them again here and into the other repos that keep a copy.
- **Nexus:** the page source is `nexus/` (`nexus/README.md`). Tags cannot be set through Nexus's v3 API: the owner sets them by hand. Never list the owner's own account (Cyberbuilds) in Nexus credits.
- **Writing style:** plain, short sentences. Tables for comparisons and lists of facts. Mark anything unverified as unverified. Never "exposes" for a port or endpoint; always say how access is locked in the same place.
- **Never commit game files** or data extracted from them (archives, DLLs, names read through REDbridge), or a player's saves.
- **Requests to other repos** (EDGEdeck's extension API for paired loadouts, REDbridge for names) go to that repo as a `request` issue with the shape that would work. Requests from other repos come here the same way: read open `request` issues at the start of a session.

## Tests

- Automated: `npm run typecheck`, `npm run build`, `npm test` (also the Check workflow on every push).
- Hand tests: numbered steps the owner runs in VS Code (F5, **Run REDsave**), written in docs/testing.md with what each step should show. Record every test's first run and later runs' results there, and keep the roadmap table in docs/index.md current. Tests that move or write saves run on a copy of the save folder until S2's swap rules have passed.
- A test that needs the game (S2's Steam Cloud check, S3a's titles in the load menu): give the owner a fixed order of numbered steps, and ask them to close the game before any swap. The game needs about 12 to 16 GB of RAM.

## Docs site

- `docs/` is published by GitHub Pages at https://edgemodders.github.io/REDsave/ through `.github/workflows/pages.yml` (Settings > Pages > Source: GitHub Actions). Jekyll renders it with the HUD layout (`docs/_layouts/default.html`, `docs/assets/css/hud.css`, copied from the other EDGE repos).
- Add every new page to `nav` in `docs/_config.yml`. `docs/changelog.md` is made from `CHANGELOG.md` by the workflow: never commit it.
- The banner, social image, Nexus picture, icon and badges come from `tools/brand/` (`render.ps1`). Update the status badge in `badges.py` when the phase changes, then render again.
