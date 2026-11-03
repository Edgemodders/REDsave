---
title: Tests
---

# <span class="y">Tests</span>

Every test run on REDsave: how to run it again, what to expect, and what it showed. Each phase ends with a hand test by the owner ([design, "Phases"](design.html#phases)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-03.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | S0 | 2026-11-03 | Pass, 4 tests |
| Release workflow, packaging only (no box ticked) | On GitHub, publishes nothing | S0 | 2026-11-03 | Pass: the .vsix and the Nexus zip as the run's artifact (run 41738195720) |
| `listSaves` on the dev PC's save folder | By script, read only | S0 | 2026-11-03 | 970 saves in 137 ms, each with its metadata; 23 empty save folders left out |

## Waiting for a hand test

None yet. The release gate: no release until every hand test of the changes since the last release has passed.

## Automated

### Type check, build and unit tests

```powershell
npm run typecheck
npm run build
npm test
```

| Test file | Checks |
|---|---|
| `test/saves.test.ts` | Save folder kinds, the newest metadata file, the default save folder, listing a folder (sorted, other files and empty save folders left out, a missing folder as none) |

## Hand tests

Each hand test lists numbered steps. Saves are the player's own work: until S2's swap rules are proven, a hand test that moves or writes saves runs on a copy of the save folder (`redsave.savesPath` pointed at it), never on the game's own.
