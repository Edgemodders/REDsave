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
| [S2a on a scratch copy, outside VS Code](#s2a-on-a-scratch-copy-outside-vs-code) | By script, on a copy | S2a | 2026-11-03 | Pass, 11 checks |
| [S2a Library and Move hand test](#s2a-library-and-move) | By hand, on the test copy | S2a | | To run (REDsave 0.0.6) |

## Waiting for a hand test

| Build | Test |
|---|---|
| REDsave 0.0.5 (clickable help examples) | [Search help examples](#search-help-examples-005) |
| REDsave 0.0.6 (S2a Library and Move) | [S2a Library and Move](#s2a-library-and-move) |

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
| `test/move.test.ts` | The library (make, rename, notes, remove only when empty), nested folders kept apart, the next free number, plans (saves already there, taken names), a move by rename (every file, the files' times, the journal on disk), a move by copy (checked, times kept, the source removed after), no move while the game runs (but between loadouts), none when a save has gone, never overwriting, a move cut short finished, undo (old names first, new numbers for names taken since, no undo of an undo) |

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

### S2a on a scratch copy, outside VS Code

Run on 2026-11-03 with a scratch script bundling `src/library.ts`, `src/move.ts`, `src/index.ts` and `src/search.ts`, on a copy of the 60 test saves in a scratch folder (never the real save folder, nor the owner's test folder):

| Check | Result |
|---|---|
| `where:game gender:male` (13 saves), all moved to a new loadout | By rename, 28 ms; found by the index in the loadout with their records whole, none left in the game |
| 5 saves to a library on E: | Copied, each `sav.dat` checked by size, 46 ms; their sources gone; undo copied them back |
| A move cut short (journal "running" with 3 saves left) | Finished at the next start |
| Every save accounted for | 60 of 60 |

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

### S2a Library and Move

REDsave 0.0.6, on the **test copy** only: 60 of your saves (1 point of no return, 5 quick saves, 5 autosaves, 49 manual saves, from three playthroughs) that Claude copied into `C:\Users\VYRAL\Saved Games\REDsave-test\saves` on 2026-11-03. Your real save folder is not touched.

Before step 1: install `redsave-0.0.6.vsix` over 0.0.5, then in VS Code's settings set **REDsave: Saves Path** to `C:\Users\VYRAL\Saved Games\REDsave-test\saves` and **REDsave: Library Path** to `C:\Users\VYRAL\Saved Games\REDsave-test\library`.

1. Open REDsave in the activity bar. **Open the Saves page** says 60 saves. **In the game** says "60 · not in a loadout yet"; open it: Manual saves 49, Quick saves 5, Autosaves 5, Point of no return 1, and Playthroughs (3). **Loadouts** says "none yet: + makes one".
2. Click the **+** on **Loadouts** and type `Corpo male V`. It appears under Loadouts with 0, and its tab opens: "No saves in this loadout yet". Right-click it, **Open Its Folder**: an empty folder in `REDsave-test\library\loadouts`.
3. In its tab, click **Add saves...**. The tab says "Add saves to Corpo male V" and lists the 60 saves. Click **Male** under V's body (13), then **Select all**. The button says **Add 13 to Corpo male V**: click it. A question asks "Move 13 saves to Corpo male V?", with "13 from the game's folder" below it: press **Move**.
4. A notice says "Moved 13 saves to Corpo male V". The tab shows its 13 saves, with "13 saves" and their size at the top. In the side bar, Corpo male V says 13 and In the game 47. The loadout's folder in Explorer now has 13 `ManualSave-...` folders, and the test saves folder 13 fewer.
5. Open the **Saves page**. A **Where** chip row shows In the game 47 and Corpo male V 13, and each save says where it is, in cyan. Type `where:game lifepath:streetkid` (12 saves), press **Select all**, then **Move to loadout...**, choose **New loadout...** and name it `Street Kid run`. Press **Move**. Street Kid run appears in the side bar with 12.
6. Right-click **Loadouts** and choose **Undo the Last Move**. The question says "Undo: Move 12 saves to Street Kid run?": press **Undo**. The 12 are back in the game (In the game 47, Street Kid run 0). Undo the Last Move again: "There is no move to undo."
7. Click **Corpo male V**. In its tab, select two saves, click **Move to...** and choose **In the game**, then **Move**. Corpo male V has 11.
8. Right-click Corpo male V: **Rename...** to `Male V tests`, then **Notes...** with `testing the jacket`. The tab's header shows both, and the side bar's tooltip shows the notes.
9. Right-click **Street Kid run** (empty), **Remove...**, **Remove**: it goes, and so does its folder. Right-click **Male V tests**, **Remove...**: it says it has 11 saves and offers **Move all to...**. Choose In the game, then **Move**. Remove it again: now it goes. In the game has 60 again.
10. Optional, with the game (it needs about 12 to 16 GB of RAM): make a loadout `Game check` and move one save into it. Start Cyberpunk 2077 and leave it at the main menu. In the Saves page, try **Move to loadout...** on a save in the game: REDsave says the game is running and moves nothing. In Game check's tab, move its save to another loadout: that works with the game running. Quit the game, then move the save back into the game.
11. Clear both settings. REDsave shows your real saves again, and Loadouts is empty (the real library has none yet). The test folder `REDsave-test` stays; delete it by hand when we are done with S2.

After the test, tell Claude which steps passed, and anything that looked wrong, slow or unclear.
