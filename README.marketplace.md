# REDsave

A save game manager for Cyberpunk 2077, in VS Code. Hundreds of saves from several playthroughs, test runs for your mods and the game's own autosaves, kept in order. **Preview.**

## Find any save

The **Saves** page shows every save with its picture, title, quest, place, lifepath, V, level, Street Cred, kind, date and play time. Search by words, filter with chips (lifepath, V's body and voice, difficulty, kind, playthrough, game version, Phantom Liberty, point of no return), or type filters such as `level:>40`, `date:2026-11` or `fact:q112_takemura_dead=0`. Sort, group by playthrough, and open a save's details for everything its metadata says.

## Loadouts

Keep sets of saves outside the game's save folder: one per playthrough, one for testing a mod, one for a friend's V. Make one with the **+** on **Loadouts** in REDsave's side bar; each opens in its own tab, where **Add saves...** picks saves from everywhere else with the same search and filters. **Swap In** puts a whole loadout into the game, and the saves that were there go to the loadout they belong to.

Moves are careful: never while the game runs, nothing deleted, every move written down first and finished if VS Code closes partway, and **Undo the Last Move** puts the saves back.

## Titles of your own

**Set title...** gives a save a title, such as "Clampdown: Takemura alive", shown in the game's own Load Game and in REDsave. **Add to titles...** adds the same text to several saves at once, and **Reset title** gives the game's title back.

## And

**Run Game**, the play button at the top of REDsave's side bar, starts the game (through EDGEdeck when it is installed, so your mod changes deploy first). Quest and place names come from your own copy of the game through REDbridge, when EDGEdeck, REDcode or REDnode has installed it.

REDsave reads saves from `Saved Games\CD Projekt Red\Cyberpunk 2077` in your user folder, where Steam, GOG and Epic copies of the game save, and keeps loadouts in `Saved Games\REDsave`. Both can be changed in the settings.

Docs and the player guide: https://edgemodders.github.io/REDsave/ · Source and issues: https://github.com/Edgemodders/REDsave

Part of the EDGE tools by [EDGEmodders](https://edgemodders.ai/). Not affiliated with CD Projekt RED. MIT licence.
