---
title: Tests
---

# <span class="y">Tests</span>

Every test run on REDsave: how to run it again, what to expect, and what it showed. Each phase ends with a hand test by the owner ([design, "Phases"](design.html#phases)); new tests are added here when they are first run, and their later runs' results too.

Last updated 2026-11-03.

## At a glance

| Test | Kind | Phase | Last run | Result |
|---|---|---|---|---|
| [Type check, build and unit tests](#type-check-build-and-unit-tests) | Automated, also on GitHub (Check) | S0, S1 | 2026-11-03 | Pass, 18 tests |
| Release workflow, packaging only (no box ticked) | On GitHub, publishes nothing | S0 | 2026-11-03 | Pass: the .vsix and the Nexus zip as the run's artifact (run 41738195720) |
| `listSaves` on the dev PC's save folder | By script, read only | S0 | 2026-11-03 | 970 saves in 137 ms, each with its metadata; 23 empty save folders left out |
| [S1 on the dev PC's saves, outside VS Code](#s1-on-the-dev-pcs-saves-outside-vs-code) | By script, read only | S1 | 2026-11-03 | Pass |
| [S1 Find hand test](#s1-find) | By hand, installed .vsix | S1 | 2026-11-03 | Pass, all 14 steps (REDsave 0.0.4) |
| [Search help examples](#search-help-examples-005) | By hand | S1 | | To run (REDsave 0.0.5) |

## Waiting for a hand test

| Build | Test |
|---|---|
| REDsave 0.0.5 (clickable help examples) | [Search help examples](#search-help-examples-005) |

The release gate: no release until every hand test of the changes since the last release has passed.

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
| `test/metadata.test.ts` | The timestamp (time, then day.month.year), the quest id, every field of a record, missing fields left unknown, a broken metadata file |
| `test/search.test.ts` | Parsing the box, words (any case and accents), chips (one key any value, two keys both, minus), playthrough numbers, ranges, dates, quests, facts, chip counts, sort, titles without names, game versions newest first, turning chips on and off |
| `test/index.test.ts` | The index's cache: each save read once, read again when changed, dropped when removed |

The tests use made-up metadata (`test/fixture.ts`), never a player's saves.

### S1 on the dev PC's saves, outside VS Code

Run on 2026-11-03 with a scratch script that bundles `src/index.ts`, `src/names.ts`, `src/game.ts` and `src/search.ts`, against the real save folder (read only; the index and names went to a scratch folder). Then the Saves page's script and styles in headless Chrome with a stand-in for VS Code, fed that index.

| What | Result |
|---|---|
| First scan | 970 saves read in 384 ms |
| Scan from the cache | 0 read, 196 ms |
| Game folder | Found through Steam: `E:\SteamLibrary\steamapps\common\Cyberpunk 2077` |
| Names | REDbridge 0.11.0 from EDGEdeck: 126 LocKeys in 4.5 s, 2 with no text |
| Searches | `little china` 243, `gender:male` 118, `playthrough:1` 828, `kind:quick` 10, `fact:q112_takemura_dead=0` 821, `lifepath:nomad` 2; 3 to 53 ms each |
| The page | Draws the chips with counts, the list with pictures and names, grouping by playthrough and the details. Found and fixed: game versions sorted 2.5 below 2.11 |

## Hand tests

Each hand test lists numbered steps. Saves are the player's own work: until S2's swap rules are proven, a hand test that moves or writes saves runs on a copy of the save folder (`redsave.savesPath` pointed at it), never on the game's own. S1 only reads.

### S1 Find

REDsave 0.0.4. In VS Code, with this repo open: `npm install` once, then **F5** (Run REDsave). The steps run in the window that opens (the Extension Development Host). The numbers below are the dev PC's on 2026-11-03; another PC shows its own.

1. Open **REDsave** in the activity bar (the bracket icon with three lines). The **Saves** view shows **Open the Saves page** with 970 saves, the kinds with their counts (Manual saves 950, Quick saves 10, Autosaves 9, Point of no return 1) and **Playthroughs**. Open Playthroughs: five, numbered by their first save, such as "1: Corpo, female V" with 828.
2. Click **Open the Saves page**. A Saves tab opens with every save, newest first, each with its picture, title, main quest and place, lifepath, V, level, Street Cred, kind, date and play time. Within about 5 seconds the bottom line says **Names from your game, through REDbridge 0.11.0** and the titles are quest names such as **Clampdown**, not ids such as "mq062 clampdown".
3. Type `little china` in the box. The count above the list says **243 of 970 saves**, and every save shown is in Little China. Press **Esc** in the box: it clears and all 970 come back.
4. Under **V's body**, click **Male**. The box now says `gender:male`, the list shows 118 saves, and the other chips' counts change to what is left (Lifepath: Corpo 118, the others 0 and greyed). Click **Male** again: it goes off.
5. Click **Search help**. The help lists the filters. Type `level:>50 date:2026-11`: only saves from November 2026 above level 50 show. Clear the box.
6. Tick **By playthrough**. The list is grouped under headers such as "Playthrough 1: Corpo, female V, 828 of 828 saves, 2025-... to 2026-11-03". Untick it.
7. Choose **Highest level** in the sort box: the highest level comes first. Choose **Newest first** again.
8. Click a save. The right side shows its picture and every field (quest, main quest, place, saved, kind, lifepath, V, level, attributes, difficulty, play time, playthrough, game, point of no return, size). Open **Quest facts** and click one, such as `q112_takemura_dead=0`: the box gets `fact:q112_takemura_dead=0` and the list shows only saves with that fact.
9. Clear the box. Ctrl+click two more saves, then Shift+click a fourth one further down: the line above the list says how many are selected, and they are lit in yellow. Press **Select all**: every save shown is selected. Press **Show in folder**: Explorer opens the game's save folder. Press **Clear selection**.
10. Click one save, then its **Show in folder** in the details: Explorer opens with that save's folder selected.
11. In the side bar, open **Playthroughs** and click **2**: the page's box says `playthrough:2` and shows that playthrough's 118 saves. Click **Autosaves**: the box says `kind:auto`.
12. Close the Saves tab and the Development Host window, then press F5 again and open the page: it opens at once (the saves come from REDsave's index, not read again), and the names show at once.
13. Optional, with the game: start it, load a save and make a manual save, while the Saves page is open in VS Code. Within a few seconds the new save is first in the list with its picture. Quit the game.
14. In the Development Host's settings, set **REDsave: Saves Path** to a folder with no saves (an empty new folder). The side bar shows "The game's save folder was not found", and the page says there are no saves. Clear the setting: the saves come back.

After the test, tell Claude which steps passed, and what looked wrong or slow.

**Result, 2026-11-03:** all 14 steps passed, on REDsave 0.0.4 installed from its .vsix. The owner's suggestion: make the help's examples clickable, so a click fills the box and searches (built in 0.0.5, below).

### Search help examples (0.0.5)

REDsave 0.0.5, installed from `redsave-0.0.5.vsix` over 0.0.4.

1. Open the Saves page and click **Search help**. The examples are in yellow; hovering one underlines it and outlines it.
2. Click `level:>40`. The box says `level:>40` and the list shows only saves above level 40 (828 of 970 on the dev PC on 2026-11-03).
3. Click `ref:>10`, then `-kind:auto`. Each one replaces what was in the box and searches with it.
4. Click `lifepath:corpo lifepath:nomad` in the last line: the box says both, and the list shows Corpo and Nomad saves. Click **Hide help**.

Checked in headless Chrome on 2026-11-03: clicking `level:>40` filled the box and gave 828 of 970.
