---
title: Design
---

# REDsave design

Draft 1, 2026-11-03. REDsave is a VS Code extension that looks after Cyberpunk 2077's save games. It has three parts:

| Part | What the player does |
|---|---|
| **Find** | Searches and filters every save by its title, quest, place, date, lifepath, V's body and voice, level, playthrough and the rest of what the save's metadata says |
| **Loadouts** | Keeps sets of saves outside the game's save folder (one per playthrough, one for testing a mod) and swaps a set in before playing |
| **Titles** | Gives a save a title of their own ("Before the heist, Takemura alive"), shown in REDsave and, if the game allows it, in the game's own load menu |

Nothing in REDsave changes the game's files. It reads saves, moves save folders and, for titles, may write a save's metadata (decided after the S3 spike).

## The game's save folder

Steam, GOG and Epic copies of the game all save to `%USERPROFILE%\Saved Games\CD Projekt Red\Cyberpunk 2077\` (setting `redsave.savesPath` for another). Seen on the dev PC on 2026-11-03, game 2.5:

| In the folder | What it is | REDsave |
|---|---|---|
| `ManualSave-<n>`, `AutoSave-<n>`, `QuickSave-<n>`, `PointOfNoReturnSave-<n>`, `EndGameSave-<n>` | One folder per save. The dev PC has 993 such folders (962 manual, 20 autosave, 10 quick, 1 point of no return), 970 of them saves (below) | Reads, and moves in loadouts |
| `user.gls`, `EnabledMods.json`, `HDRUserSettings.json` | The game's settings and mod.io state, not saves | Never touched |
| `steam_autocloud.vdf` | Steam Cloud syncs this folder | Never touched; see "Steam Cloud" |
| Empty save folders | 23 on the dev PC: 11 autosaves from 2026-11-03 and 12 manual saves from 2024-07-24, with no files at all. Left when a save was removed (unverified by what: the game rotating autosaves, a delete in the load menu, or Steam Cloud) | Not saves: a folder counts only with `sav.dat` in it. Never moved or removed |

Each save folder holds:

| File | Size on the dev PC | What it is |
|---|---|---|
| `sav.dat` | about 5.7 MB | The save itself (binary). REDsave never reads or writes it in S1 and S2 |
| `metadata.9.json` | about 6 KB | What the load menu shows, as JSON. The number is the format (9 in game 2.5); REDsave reads the highest one present |
| `screenshot.png` | about 200 KB | The picture in the load menu |

### What the metadata says

From `metadata.9.json` of a game 2.5 autosave (`Data.metadata`). Every field here can be indexed; the third column says how REDsave uses it.

| Field | Example | Used for |
|---|---|---|
| `name` | `AutoSave-2` | The folder's name; the kind of save (manual, auto, quick, point of no return, end of the game) |
| `trackedQuest` | `LocKey#98600` (Clampdown) | The title, until the player gives one. Searched |
| `mainQuest` | `LocKey#9860` | Searched; shown under the title |
| `trackedQuestEntry` | `quests/minor_quest/mq062_clampdown/...` | The quest's id when no name can be read (`mq062_clampdown`) |
| `locationName` | `LocKey#10963` (Little China) | Searched; filter by district |
| `lifePath` | `Corporate` (also `Nomad`, `StreetKid`) | Filter |
| `bodyGender`, `brainGender` | `Female`, `Female` | Filter: V's body, and V's voice (they can differ) |
| `level`, `streetCred` | `60`, `58` | Filter by range; sort |
| `strength`, `intelligence`, `reflexes`, `technicalAbility`, `cool` | `15`, `20`, `20`, `20`, `6` | Filter by range (the game's Body, Intelligence, Reflexes, Technical Ability, Cool); shown in the details |
| `difficulty` | `VeryHard` | Filter |
| `playTime`, `playthroughTime` | `448042.4` (seconds) | Shown as hours; sort; filter by range |
| `timestampString` | `18:03:12, 3.11.2026` | The date. Its day and month order is unverified across Windows locales, so the folder's time is the fallback |
| `playthroughID` | `658432f41d8cbcc0` | Groups saves by playthrough; filter. A playthrough has no name in the game: the player names it in REDsave |
| `buildPatch`, `gameVersion`, `saveVersion` | `2.5`, `2500`, `277` | Filter by game version; a warning on saves from a newer game than the one installed |
| `additionalContentIds` | `["EP1"]` | Filter: Phantom Liberty |
| `isPointOfNoReturn`, `isEndGameSave`, `isCheckpoint`, `isForced` | `false` | Filters |
| `isModded` | `true` | Filter |
| `finishedQuests` | `q004 q005 ... mq041` | Search and filter by a finished quest ("saves after The Heist") |
| `facts` | `q112_takemura_dead=0` | Advanced filter by a quest fact and its value ("Takemura alive") |
| `activeQuests` | hashes | Not used (no names) |
| `playerPosition` | X, Y, Z | Not used in S1; maybe a map later |
| `userName` | empty | Unknown; a candidate for titles (S3 spike) |
| `fileSize` | `6053063` | Shown in the details; loadout sizes |

The fields' names are as the game writes them in 2.5; older saves (metadata 8 and below) may lack some, and REDsave shows those as unknown, never as false. Unverified: which fields older formats have.

### Names for LocKeys

`trackedQuest`, `mainQuest` and `locationName` are LocKeys. REDbridge turns them into the words the player sees, from their own copy of the game: on 2026-11-03 REDcode's `loc_get` (through REDbridge) gave `LocKey#98600` "Clampdown", `LocKey#9860` "Nocturne Op55N1", `LocKey#10963` "Little China". So:

- REDsave finds REDbridge where REDnode, EDGEdeck or REDcode put it (REDnode's `packages/overlay/redbridge.js` has the lookup), and asks it for the names of the keys its saves use.
- The names are kept in REDsave's own storage on the player's PC, never committed or shipped (game data).
- Without REDbridge, the title is the quest's id made readable (`mq062_clampdown` as "mq062 clampdown") and the place is left out. Search still works on everything else.
- The language: English first (`en-us`). The game's language later (unverified how REDbridge reads other languages' files).

## Find (S1)

A **Saves** page (a webview) and the **Saves** view in REDsave's side bar.

| Piece | What it does |
|---|---|
| Search box | Words, matched across the title, quest, main quest, place, lifepath, the player's notes and the folder name, case and accents ignored. Several words all must match |
| Filter chips | Lifepath, body, voice, difficulty, kind of save, playthrough, game version, Phantom Liberty, point of no return, modded. A chip shows its counts ("Corpo 412") from the saves the other filters leave |
| Ranges | Level, Street Cred, play time, date, and the five attributes |
| Advanced | Finished quest (by id; quest names for these ids are not read yet) and quest fact (`q112_takemura_dead=0`) |
| Sort | Newest first (default), oldest, play time, level, title |
| Group | By playthrough, with each playthrough's lifepath, V and number of saves |
| Each save | Its picture, title, quest and place, lifepath, level, kind and date; the details (every field above) on click |
| Select | Ctrl and Shift clicks, and **Select all** for every save the search and filters leave, with the count shown. In S1 a selection can only be looked at (Show in folder); from S2 it is moved to a loadout ("Adding saves to a loadout") |
| Search syntax | Plain words for everyone; `lifepath:corpo`, `level:>40`, `fact:q112_takemura_dead=0` typed in the box for those who want it (the chips write the same words) |

The index: one pass over the save folders reads each metadata file (about 6 MB in all for 970 saves) and keeps the result in REDsave's global storage, keyed by folder, the metadata file's time and its size, so later starts read only what changed. A file watcher on the save folder picks up new saves while the game runs. Pictures are shown from the save folder itself (the webview's local resource roots), not copied. Measured on the dev PC on 2026-11-03: the first pass over 970 saves takes 384 ms, a start from the cache 196 ms.

### S1: built

Built on 2026-11-03; **passed the owner's hand test the same day** (REDsave 0.0.4, all 14 steps; [Tests](testing.html), "S1 Find"). REDsave 0.0.5 adds the owner's suggestion from it: the examples in **Search help** are clickable, each one filling the box and searching.

| File | What it does |
|---|---|
| `src/metadata.ts` | A save's metadata into a `SaveRecord`: every field in the table above, the timestamp parsed as time then day.month.year (the file's time when it has another shape), the quest id from `trackedQuestEntry`, a `problem` for a broken file |
| `src/index.ts` | `SaveIndex`: the records kept in global storage (`index.json`), keyed by folder and stamped by the metadata's, `sav.dat`'s and the picture's times and sizes; a watcher on the save folder rescans 1.5 s after the game stops writing |
| `src/names.ts` | `Names`: finds REDbridge (REDnode's, EDGEdeck's and REDcode's copies, the newest first) and .NET 10, starts it with `--game`, calls `loc.get` in batches of 500, keeps the names in `names-en-us.json`, stops REDbridge after 2 minutes idle |
| `src/game.ts` | The game folder: the `redsave.gamePath` setting, EDGEdeck's when it runs, else Steam, GOG or Epic (from EDGEdeck's lookup) |
| `src/search.ts` | The search box's words and `key:value` filters, chips with their counts, ranges, dates, quests, facts, sort, playthroughs. Shared by the page and the tests |
| `src/page.ts`, `webview/page.ts`, `media/page.css` | The Saves page: the box, the chips (a key shows when its saves differ: on the dev PC difficulty, Phantom Liberty and modded are hidden, since every save has the same value), sort, By playthrough, the list with pictures, selection, the details with clickable quests and facts, the names' status |
| `src/extension.ts` | The side bar: Open the Saves page, the kinds and the playthroughs, each opening the page with its filter |

The filters as built: `lifepath:` (corpo, nomad, streetkid), `gender:` (V's body, female or male), `voice:`, `difficulty:`, `kind:` (manual, auto, quick, ponr, endgame), `playthrough:<number>`, `version:`, `pl:`, `ponr:`, `modded:` (yes or no); ranges `level:`, `cred:`, `hours:`, and the attributes `body:`, `int:`, `ref:`, `tech:`, `cool:` (`>40`, `<20`, `30-50`, `42`); `date:2026-11`, `date:>2026-10-01`; `quest:<id>`; `fact:<name>=<value>`; `-` before any of them leaves out what matches. Playthroughs are numbered by their first save.

Seen on the dev PC's 970 saves (2026-11-03, read only):

| Finding | Detail |
|---|---|
| Formats | Every save is `metadata.9.json`, from game 2.1 to 2.5 |
| Timestamps | All 970 read as time then day.month.year, and match `sav.dat`'s time |
| Playthroughs | 5: Corpo female V (828 saves), Corpo male V (118), Street Kid female V (22), two Nomad female V (1 each) |
| Names | REDbridge 0.11.0 (EDGEdeck's copy) gave the 126 LocKeys in 4.5 s the first time; 2 have no text. Later starts read them from the store |
| Searches | 3 to 53 ms each over 970 saves (the fact filter is the slowest) |

Saves in loadouts (S2) are indexed the same way, and the page searches across the game's folder and every loadout, with a chip for where a save is.

## Loadouts (S2)

A loadout is a named set of save folders kept in REDsave's library, outside the game's save folder. One loadout is "in the game" at a time.

```
<library>/                          redsave.libraryPath; default %USERPROFILE%\Saved Games\REDsave
  library.json                      the loadouts, which is in the game, the swap journal
  loadouts/<id>/
    loadout.json                    name, notes, created, the playthroughs it holds
    ManualSave-12/                  save folders exactly as the game wrote them
    AutoSave-3/
  titles.json                       the player's titles and notes, by save identity (S3)
```

The default library is beside the game's save folder, on the same drive and outside the folder Steam Cloud syncs, so a swap renames folders at once. Another drive works by copying (slower, checked, then the old copy removed).

The loadout in the game keeps its saves in the game's save folder, where the game reads them; the others keep theirs in the library. So every save is in exactly one place, and moving a save to the loadout in the game puts it in the game's folder.

### Adding saves to a loadout

Saves are picked on the Saves page, which searches across the game's folder and every loadout (S1). A search or a filter, then **Select all** (or Ctrl and Shift clicks), gives a selection; the actions work on all of it at once:

| Action | What it does |
|---|---|
| **Move to loadout...** | Picks a loadout, or a new one named from the search ("Corpo, Takemura alive"). The saves leave where they were and join it. Moving to the loadout in the game puts them in the game's folder, ready to load |
| **New loadout from selection** | Move to a new loadout in one step |

Examples: filter Phantom Liberty saves of one playthrough and move them all into the game's loadout before a run through Dogtown; filter every save from game versions before 2.0 and move them to an "Old saves" loadout; select the results of `fact:q112_takemura_dead=0` and move them to a loadout for a mod test.

A move asks once, with the count and where the saves go ("Move 42 saves to Dogtown run? 38 come from the game's folder, 4 from Old saves"). Moves into or out of the game's folder follow the swap rules below, so the game must be closed.

Decided with the owner on 2026-11-03: saves are only **moved**, so each save is in one place. There is no Copy for now; copies, perhaps by hard link, are a research item for later ("Later: copies by hard link").

### Swap rules

1. **Never while the game runs.** REDsave checks for `Cyberpunk2077.exe` and refuses.
2. **Nothing is deleted.** Before a loadout comes in, the save folders in the game's folder go to the loadout that is in the game, or to a new one named "Saved on <date>" if none is.
3. **Only save folders move.** The game's other files in the folder (`user.gls`, `EnabledMods.json`, `HDRUserSettings.json`, `steam_autocloud.vdf`) stay.
4. **A journal.** Each move is written to `library.json` before it is made, so a swap cut short (power off, VS Code closed) finishes or rolls back at the next start.
5. **Names that clash.** Saves that come into a folder (the game's or a loadout's) where a save of the same name already is get the next free number of their kind. Unverified: whether the metadata's `name` must then change to match the folder.
6. **Undo** the last swap or move.

### Steam Cloud

The dev PC's save folder has `steam_autocloud.vdf`: Steam Cloud syncs it. Moving saves out of the folder may make Steam delete them from the cloud too, and moving them back uploads them again. Unverified: what Steam does with a folder changed while Steam runs but the game does not, and whether it asks about a conflict at the next start. S2's test checks it on the dev PC before any release. Until then REDsave says, at the first swap on a PC with Steam Cloud, that the saves are kept in REDsave's library and Steam's cloud copy follows the game's folder. GOG Galaxy's cloud saves are the same question (unverified).

### S2: plan

Proposed on 2026-11-03, to agree with the owner. S2 is the first phase that moves saves, so it is split in two, and S2a is tested on a copy of the save folder before anything touches the real one.

| Part | What | Tested on |
|---|---|---|
| **S2a Library and Move** | The library, the Loadouts node and its children, a tab per loadout with **Add saves...** and **Move to...**, the **Where** chip and **Move to loadout...** on the Saves page, the journal, undo, the game-running check | A copy of some saves (`redsave.savesPath` and `redsave.libraryPath` pointed at test folders) |
| **S2b Swap** | **Swap in** a whole loadout, the Steam Cloud explanation, renumbered folders checked in the game | The real save folder, after S2a passes, with a throwaway save for the Steam Cloud check |

#### What the player sees

The owner's approach (2026-11-03): loadouts are children of a **Loadouts** node in REDsave's side bar, and clicking one opens a tab for just that loadout, where saves are added to it. Decided the same day: one level of loadouts to start with; folders of loadouts are decided after some testing.

| Where | What |
|---|---|
| Side bar, **Loadouts** node | Its **+** makes a new loadout: the player types its name and it becomes a child. Each child shows its number of saves; the one the game's saves belong to is marked "in the game". A child's menu: **Rename**, **Notes**, **Swap in** (S2b), **Open its folder**, **Remove** (only an empty one). Above the Loadouts node, **In the game** shows the saves in the game's folder and which loadout they belong to, or "not in a loadout yet" |
| A loadout's tab | Opened by clicking the loadout: its name, notes, count and size at the top, with **Swap in** (S2b); its saves below, with the Saves page's search, chips, sort and details. Selecting some of its saves gives **Move to...**: to the game or another loadout |
| **Add saves...** in a loadout's tab | Switches the tab to a picker of every save not in this loadout (the game's folder and the other loadouts), with the full search and filters. Filter, **Select all** or pick by hand, then **Add 42 to Dogtown run** |
| The Saves page | A **Where** chip row: In the game, then each loadout, with counts (`where:game`, `where:"Dogtown run"` in the box). The selection line gets **Move to loadout...** beside Show in folder, a shortcut for saves found there first |
| Each move | One question with the counts before anything moves: "Move 42 saves to Dogtown run? 38 from the game's folder, 4 from Old saves." The same move, checks and undo whichever way it is started |
| Swap in (S2b) | "Swap in Dogtown run? The 812 saves in the game go to Main playthrough, and Dogtown run's 42 come in." With no loadout in the game yet, it asks for a name for the saves there first ("Saved on 2026-11-03" by default) |
| Undo | **Undo the last move** in the Loadouts node's menu and in a notice after each move, for the last move or swap |

#### How a move works

1. **Checks first, nothing moved yet.** A move into or out of the game's folder is refused while `Cyberpunk2077.exe` runs (moves between loadouts in the library are allowed). Each source folder must still have `sav.dat`. The target must have room: on another drive, its free space is checked against the saves' sizes.
2. **The journal.** The whole move is written to `library.json` before the first folder moves: each save's source, target and state. A folder's state turns `done` as soon as it has moved.
3. **Each folder.** On the same drive, one rename of the whole folder, which Windows does at once and completely or not at all. On another drive, a copy of its files, each checked by size, then the source removed only after the copy checks out.
4. **Names that clash.** A save coming into a folder that already has one of its name gets the next free number of its kind (ManualSave-12 becomes ManualSave-1001). Only the folder is renamed in S2a; whether the metadata's `name` must change too is checked in the game in S2b.
5. **After.** The index rescans the folders that changed, and the page and side bar update.
6. **A move cut short** (VS Code closed, power off) is finished at the next start from the journal: a folder still at its source is moved, and a half-made copy on another drive is removed while its source is still whole. Then REDsave says what it finished.

Nothing in S2 deletes a save. Removing a loadout is offered only when it is empty, and **Undo** moves saves back the same way.

#### The library

```
Saved Games\REDsave\               redsave.libraryPath
  library.json                     format, the loadout in the game, the loadouts (id, name, notes,
                                   created), the journal of the last move
  loadouts\<id>\                   a loadout's save folders, exactly as the game wrote them
```

The index reads each loadout's folder as it reads the game's, so search, chips and details work across all of them. A moved save is read again at its new place (6 KB of metadata, so it costs nothing to notice).

#### Steam Cloud (S2b)

The game's folder has `steam_autocloud.vdf`. Before the first swap or move out of the game's folder on a PC with it, REDsave explains once: the saves are kept in REDsave's library, and Steam's cloud copy follows what is in the game's folder. S2b's test checks what Steam really does, on the dev PC with one throwaway save: make a manual save, move it out, start the game through Steam, and see whether Steam brings it back, asks about a conflict, or leaves it gone. If Steam brings saves back, swaps would leave copies in the game's folder (no loss, but not what a swap means), and S2b stops there to agree a fix with the owner.

#### S2a: built

REDsave 0.0.6, built on 2026-11-03; 0.0.7 fixes what its first hand test found at step 5, 0.0.8 what its second found (see Tests). **Passed the owner's hand test on 2026-11-03** ([Tests](testing.html), "S2a Library and Move"), on the test copy of 60 saves in `C:\Users\VYRAL\Saved Games\REDsave-test\saves`.

| File | What it does |
|---|---|
| `src/library.ts` | `Library`: `library.json` (format, the loadout in the game, the loadouts, the journal of the last move), written whole through a temporary file; loadouts made, renamed, given notes, and removed only when their folder is empty (Windows' rmdir refuses anything else); `within` keeps the library and the game's folder apart |
| `src/move.ts` | `planMove` (saves already there left alone, taken names given the next free number), `runMove` (the game-running check through `tasklist`, every source checked for `sav.dat`, room per target drive, the journal before the first folder, a rename on the same drive or a copy checked file by file with the files' times kept, then the source removed), `recover` (a move cut short finished at the next start, a half-made copy beside a whole source redone), `undoPlan` (the last move put back, old names first, then new numbers for names taken since; an undo is not undone) |
| `src/extension.ts` | The side bar: **In the game** (its kinds and playthroughs inside it) and **Loadouts** with **+**, its children, their menus (Open, Rename, Notes, Open Its Folder, Remove) and **Undo the Last Move**; one question with the counts before each move; a progress notice; recovery at start |
| `src/page.ts`, `webview/page.ts` | A tab per loadout: the header, its saves, **Add saves...** (a picker of every save elsewhere) and **Move to...**; **Move to loadout...** on the Saves page; where a save is shown in cyan when a list has more than one place |
| `src/search.ts` | The **Where** chip and `where:` (`where:game`, `where:"Dogtown run"`) |

The owner's hand test (2026-11-03) found that an undo into a removed loadout put its saves back in the folder but not the loadout in the list. REDsave 0.0.8 remembers removed loadouts (`removed` in `library.json`, the last 50) and lists again any folder in `loadouts\` that holds anything but is not in the list (`Library.adopt`, at start, after a library change and after every move), with its old name, or one made from its folder's name, and a note; an empty stray folder is removed.

Checked on 2026-11-03: 29 unit tests (31 with 0.0.8's); an end-to-end script on a scratch copy of the 60 test saves (13 saves moved by rename in 28 ms, 5 copied to a library on E: in 46 ms and back by undo, a move cut short finished, all 60 saves accounted for); the loadout tab and its picker in headless Chrome.

#### S2b: built

REDsave 0.0.9, built on 2026-11-03, awaiting the owner's hand test ([Tests](testing.html), "S2b Swap"): part A on the test copy, part B (Steam Cloud, a renumbered save) in the game with one throwaway save.

| Where | What |
|---|---|
| `src/move.ts` | `planSwap`: the game's saves out to the loadout they belong to, then the loadout's in, as one plan; incoming names checked against the game's folder as it will be once the outgoing saves have left. A journal records the loadout in the game before and after (`inGame`), set when the move completes, kept as it was when a move stops, set by recovery when a cut swap is finished, and put back by undo. Undo runs in reverse order and does not count names held by saves it moves away, so a swap's undo renames nothing. Empty save folders (the game leaves them) are free names: `moveFolder` removes an empty folder in the way with rmdir |
| `src/extension.ts` | **Swap In** (the loadout's menu and its tab): asks a name for the game's saves when no loadout is in the game ("Saved on <date>"), one question with the counts, then the swap. The loadout in the game owns the saves in the game's folder: its count and tab show them, a move to it goes to the game's folder, and **Move to...** lists it once, as In the game. The Steam Cloud notice, once, before saves first leave a folder with `steam_autocloud.vdf` |
| `webview/page.ts` | A loadout's tab shows **In the game** or **Swap in** in its header |

Checked on 2026-11-03: 35 unit tests (4 for swaps: empty folders, a swap and its undo, a swap that stops, a swap cut short); an end-to-end script on a scratch copy of the test saves with the game's own files and three empty save folders (a swap of 60 in 97 ms with none renamed, a save made while a loadout is in staying with it, a swap back, its undo, 61 of 61 saves accounted for).

#### Decided for S2

Agreed with the owner on 2026-11-03, with the tree and tab approach above:

| Question | Decision |
|---|---|
| Split S2 into S2a (Move, on a copy) and S2b (Swap, the real folder)? | Yes: the move rules are proven before the real saves are moved |
| Moves between loadouts while the game runs | Allowed; only moves into or out of the game's folder wait for the game to close |
| A loadout with saves: remove it? | No; **Move all to...** is offered first. A loadout can be removed only when empty |
| The test copy for S2a | Claude copies 60 saves (all kinds, three playthroughs) from the real folder into a test folder, reading the real one only |
| Folders of loadouts | One level to start with; decided after some testing |

### Later: copies by hard link

A research item, not scheduled (the owner, 2026-11-03: build with Move only, keep this in the notes). A copy of a save in a second loadout could be a set of hard links to the same files, so it takes no extra space, as EDGEdeck deploys mods by hard link.

| Point | What is known |
|---|---|
| Folders | Only files link, not folders: each save is 3 files (`sav.dat`, `metadata.<n>.json`, `screenshot.png`), so about 2,900 links for 970 saves |
| Drives | Links work only on the same NTFS drive; another drive needs real copies |
| The game saving over a linked save | **Unknown, and it decides the idea.** If the game rewrites `sav.dat` in place, every linked copy changes with it, which a copy must not do. If it writes a new file and replaces the old one, the link breaks quietly and each copy keeps its own version |
| The game deleting a linked save (autosave rotation, Delete in the load menu) | Only that link goes; the other copies keep the save |
| Steam Cloud | Sees plain files |

The first step is a short test with a throwaway save: make a new manual save, link its three files into a test folder, save over it in the game, then check with `fsutil hardlink list <file>` whether the files are still linked and which version each name shows. If the game writes in place, copies stay real copies (about 6 MB each), or are not offered.

## Titles (S3)

The player gives a save a title of their own. REDsave always shows it, searches it and keeps it in `titles.json` by the save's identity (`playthroughID` plus `timestampString` and `playTime`), so it follows the save into and out of loadouts.

The owner's wish (2026-11-03): edit the name a save shows **in the game's load menu**, adding text of their own to tell one save from another, such as "Clampdown: Takemura alive" where the menu now says only "Clampdown". So S3's title is the quest name plus the player's text by default, and the whole name can be replaced.

Whether the **game's** load menu can show it is open. S3a is a spike to find out, on copies of saves only:

| Way | How | Risk |
|---|---|---|
| A. Metadata | Write the title into a field the load menu shows (`trackedQuest` with plain text in place of a LocKey, or `userName`), keeping the original in REDsave | Unverified whether the menu reads `metadata.9.json` or `sav.dat` for the list, and whether a changed field breaks the load. The cheapest if it works |
| B. A small game-side part | A redscript (or REDnode) piece that shows REDsave's title in the load list, read from a file REDsave writes | Needs redscript and Codeware in the player's game; does not change saves |
| C. Both | A for players without script mods, B for the rest | More to keep working |

The load list is drawn by `LoadListItem` (`SetMetadata`), the save menu by `SaveGameMenuGameController`, as an earlier experiment in `../SaveTags` (redscript with Codeware, January 2026) shows. That folder's origin and licence are unknown (it calls a `NamedSavesEnv` it does not define, perhaps from another mod): read it only as a hint of where to look, and ask the owner before reusing any of it.

## Phases

Each phase ends with a hand test by the owner.

| Phase | What |
|---|---|
| S0 Repo | This repo, the scaffold, the release workflow, the brand, the design |
| S1 Find | The index, the Saves page with search, filters, ranges, sort and groups, names through REDbridge. Read only: nothing is written to the save folder |
| S2 Loadouts | The library, swap, moving a selection of saves to a loadout, undo, the journal, the game-running check, the Steam Cloud test |
| S3 Titles | S3a the spike (ways A and B on copies), then S3b titles in REDsave and in the game by the way chosen |
| S4 First release | 0.1.0 on the Marketplace, Open VSX and Nexus Mods, after every hand test |
| Later, not agreed | Copies of saves, perhaps by hard link ("Later: copies by hard link"); MCP tools for assistants (`save_search` read only, swaps asking first, as EDGEdeck's); a save loadout paired with an EDGEdeck mod loadout; notes, tags and favourites; comparing two saves' facts; clearing old autosaves into a loadout; a REDnode window in the game |

## Decisions and open questions

Decided with the owner on 2026-11-03:

| Question | Decision |
|---|---|
| The library's default place | `%USERPROFILE%\Saved Games\REDsave`: the same drive as the saves (instant moves), outside the folder Steam syncs, not under Documents (OneDrive would sync gigabytes) |
| One loadout in the game at a time, or several | One: simple to explain, and what a swap means. Saves from other loadouts join it by Move to loadout |
| Adding saves to a loadout | Move only; copies (perhaps by hard link) are a research item |
| Where names come from | REDbridge, found where the other EDGE tools put it; no hard dependency |

Still open:

| Question | Recommendation |
|---|---|
| Titles in the game | Decide after S3a |
| Pair save loadouts with EDGEdeck's mod loadouts | Later, through EDGEdeck's extension API (a request issue there), once both sides exist |
