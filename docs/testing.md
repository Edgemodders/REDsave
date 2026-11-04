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
| [Search help examples](#search-help-examples-005) | By hand | S1 | 2026-11-03 | Pass |
| [S2a on a scratch copy, outside VS Code](#s2a-on-a-scratch-copy-outside-vs-code) | By script, on a copy | S2a | 2026-11-03 | Pass, 11 checks |
| [S2b on a scratch copy, outside VS Code](#s2b-on-a-scratch-copy-outside-vs-code) | By script, on a copy | S2b | 2026-11-03 | Pass, 13 checks |
| [Run Game (0.0.10)](#run-game-0010) | By hand, with the game | S2b | 2026-11-03 | Pass, 3 steps |
| [S2b Swap hand test](#s2b-swap) | By hand; part B with the game | S2b | 2026-11-03 | Pass: part A (steps 0 to 7) and part B (Steam Cloud quiet, a renumbered save loads) |
| [S2a Library and Move hand test](#s2a-library-and-move) | By hand | S2a | 2026-11-03 | Pass on 0.0.7 and 0.0.8 (0.0.6 stopped at step 5; an undo into a removed loadout, found in the second run, fixed in 0.0.8) |

## Waiting for a hand test

| Build | Test |
|---|---|
| None | |

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
| `test/swap.test.ts` | Empty save folders as free names, a swap without renaming the names that leave and its undo (the game's own files left alone, the loadout in the game set and put back), a swap that stops partway (the loadout in the game unchanged), a swap cut short finished at the next start |
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

### S2b on a scratch copy, outside VS Code

Run on 2026-11-03 on a copy of the 60 test saves in a scratch folder, with `user.gls`, `steam_autocloud.vdf` and three empty save folders added as the real folder has them:

| Check | Result |
|---|---|
| Swap in a loadout of 20 with no loadout in the game | 60 moved in 97 ms (40 out to "Saved on", 20 in), none renamed; the game's own files stayed |
| A save made while that loadout is in | Stays with it: the next swap took 21 out |
| Swap the other loadout back in, then undo | 61 moved in 94 ms; the undo put everything back, set the loadout in the game back, renamed nothing |
| Every save accounted for | 61 of 61 |

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

**First run, 2026-11-03, REDsave 0.0.6:** steps 1 to 4 passed. At step 5, **Move to loadout...** only said "REDsave is moving saves already": REDsave stayed busy until step 4's notice (with its Undo and Open buttons) was closed. REDsave 0.0.7 ends the busy state as soon as the saves have moved, and a notice's **Undo** undoes only its own move (if a newer move came after, it says so instead of undoing the newer one). The retest goes on from step 5 on 0.0.7, with the library as step 4 left it.

**Second run, 2026-11-03, REDsave 0.0.7:** every step worked as written, and the Search help examples (0.0.5) passed too. The owner found one problem: after moving all of a new loadout's saves into the game, removing the empty loadout and choosing **Undo the Last Move**, the undo put the saves back into the removed loadout's folder, and REDsave did not list that loadout again, so the saves showed nowhere. Claude read the library afterwards: the moves had run on the **real** save folder and the default library (`Saved Games\REDsave`), not the test folders, so the two path settings were not in effect during the run. Nothing was lost: the real save folder had 75 fewer save folders (918 entries, 993 before), all 75 in the library: 53 in the loadout Corpo Male V Saves, 22 in the removed loadout's folder `loadouts\street-kid-41c496`.

REDsave 0.0.8 fixes it: a removed loadout's name is remembered, and any folder in `loadouts\` that holds saves but is not in the list is listed again (at start, after a library change and after every move), with its old name or one made from its folder's name, and a notice saying so. The test's 22 saves come back as **Street Kid**.

Check for 0.0.8, on the library as the second run left it:

1. Install `redsave-0.0.8.vsix` over 0.0.7. A notice says REDsave found Street Kid (22 saves) again, and **Street Kid** is under Loadouts with 22, its notes saying it was listed again.
2. Open **Street Kid** and **Corpo Male V Saves**: 22 and 53 saves.
3. To put your real saves back where they were: in each of the two loadouts' tabs, press **Select all**, then **Move to...** > **In the game** > **Move** (with the game closed). In the game has every save again, and REDsave's library is empty. Then remove the two empty loadouts.

**Result, 2026-11-03, REDsave 0.0.8:** steps 1 and 2 passed: Street Kid came back with its 22 saves. Step 3 was skipped by choice: the owner keeps both loadouts (Street Kid, 22 saves; Corpo Male V Saves, 53) with their real saves in REDsave's library for now. **S2a is done.**

### S2b Swap

REDsave 0.0.9. Install `redsave-0.0.9.vsix` over 0.0.8. Part A runs on the test copy; part B uses the game and one throwaway save in your real save folder.

**Part A: swaps, on the test copy.** In VS Code's settings (Ctrl+,, the **User** tab: a value under Workspace applies only while that folder is open) set **REDsave: Saves Path** to `C:\Users\VYRAL\Saved Games\REDsave-test\saves` and **REDsave: Library Path** to `C:\Users\VYRAL\Saved Games\REDsave-test\library`.

0. Check the settings took: open the **Saves page**; its bottom line must start with `C:\Users\VYRAL\Saved Games\REDsave-test\saves` and say 60 saves, and **Loadouts** in the side bar must say "none yet" (your real library has Street Kid and Corpo Male V Saves: seeing them means the Library Path is not in effect). If either is wrong, stop and tell Claude.
1. Make a loadout `Dogtown run`, and with **Add saves...** add the 13 `gender:male` saves to it.
2. Right-click **Dogtown run**, **Swap In**. REDsave asks a name for the 47 saves in the game, with `Saved on 2026-11-03` filled in: press Enter. The question says "Swap in Dogtown run?", that the 47 saves in the game go to Saved on 2026-11-03, and that Dogtown run's 13 saves come into the game's folder. Press **Swap in**. A notice says "Swapped in Dogtown run: 13 saves in the game, 47 moved to Saved on 2026-11-03."
3. In the side bar: **In the game** says "13 · Dogtown run"; Dogtown run says "13 · in the game" with a filled dot; Saved on 2026-11-03 says 47. Dogtown run's tab shows its 13 saves and **In the game** in its header, with no Swap in button.
4. Open **Saved on 2026-11-03** and press **Swap in** in its tab's header. The question says the 13 saves in the game go to Dogtown run and its 47 come in: **Swap in**. In the game says "47 · Saved on 2026-11-03".
5. Right-click **Loadouts**, **Undo the Last Move**: "Undo: Swap in Saved on 2026-11-03?", **Undo**. In the game says "13 · Dogtown run" again, and Saved on 2026-11-03 has 47.
6. On the **Saves page**, select one save in Saved on 2026-11-03 and press **Move to loadout...**: the list shows **In the game** with "Dogtown run" in its description, and Dogtown run is not listed a second time. Choose In the game, **Move**: Dogtown run (in the game) has 14.
7. Empty both settings: in Settings (Ctrl+,), search `redsave` and delete the text in **REDsave: Saves Path** and **REDsave: Library Path**, leaving both boxes empty, so REDsave goes back to your real save folder and `Saved Games\REDsave`. The bottom line of the Saves page shows your real save folder again, and Loadouts shows Street Kid and Corpo Male V Saves.

**Part B: Steam Cloud and a renumbered save, with the game and your real save folder.** It needs about 12 to 16 GB of RAM. Your two loadouts (Street Kid, Corpo Male V Saves) hold 75 real saves outside the game's folder: Steam Cloud may drop its cloud copies of them when the game starts (part B finds out what it does). To avoid that, move them back into the game first with **Move all to...**; otherwise leave them.

8. Start the game through Steam, load any save, make a new manual save (the throwaway), and quit. In Steam's library, wait until the game's cloud status is up to date.
9. In REDsave, **Refresh**. The throwaway is the newest save on the Saves page: note its folder name (its details, Kind: ManualSave-N). Select it, **Move to loadout...**, **New loadout...** `Steam test`, **Move**. Before it moves, REDsave says once that Steam Cloud syncs the game's folder: press **Continue**.
10. Start the game through Steam again. Note anything Steam shows (a cloud conflict, a sync message) and whether the game's **Load Game** lists the throwaway. Make one more manual save, then quit.
11. In REDsave, **Refresh**. Note: is the throwaway back in the game's folder (Steam put it back), or only in Steam test? Is the new save's folder name the same as the throwaway's?
12. Move the throwaway from Steam test back **In the game**. If its name is taken now (step 11), the question says it gets a new folder number. Start the game, and **load the throwaway** from Load Game: note whether it loads, and its title in the list. Quit.

After the test, tell Claude which steps passed, and what you noted in steps 10 to 12.

**Part A, 2026-11-03, REDsave 0.0.9:** steps 0 to 7 passed on the test copy.

**Part B, 2026-11-03, REDsave 0.0.9, the real save folder:** passed. The owner moved the throwaway save (`ManualSave-1554`, 20:45) into a new loadout, Steam test, started the game through Steam, made a new save and quit, then moved the throwaway back into the game. Steam never showed a sync error or a conflict, at any step. The new save had taken the throwaway's number (`ManualSave-1554`, 20:49), so REDsave gave the throwaway `ManualSave-1555`; its metadata still says `"name": "ManualSave-1554"`, and it showed in Load Game before the new save and loaded fine. Read by Claude from REDsave's journal and the two saves' metadata afterwards (read only).

| Question | Answer |
|---|---|
| Does Steam Cloud complain when saves leave the game's folder and come back? | No: no sync error or conflict, through two game starts |
| Does a save load from a folder renumbered by REDsave? | Yes, with its metadata's `name` left as it was: the folder's number need not match it |

### Run Game (0.0.10)

Asked for by the owner on 2026-11-03: a play button at the top of REDsave's side bar that starts the game, like EDGEdeck's. Install `redsave-0.0.10.vsix` over 0.0.9 (after S2b's part B, or during it: it changes nothing else).

1. The REDsave view's title bar shows a play icon first, with the tooltip **Run Game**.
2. With the game closed, press it. With EDGEdeck installed, it runs EDGEdeck's Run game: any pending mod changes deploy first, then Steam starts the game. (Without EDGEdeck, Steam starts it with `-modded`.)
3. With the game running, press it again: "Cyberpunk 2077 is already running." Quit the game.

**Result, 2026-11-03:** all 3 steps passed.
