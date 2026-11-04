# Changelog

What changed in each REDsave release, for players. Each release takes its notes from its section here: the GitHub release, the Marketplace's changelog tab and the version's changelog on the Nexus Mods page.

How to keep it (the Edgemodders convention):

- With each change a player would notice, add a line under **Unreleased**, in its group: **New**, **Changed**, **Fixed** or **Other**. One change per line. Leave out test-only changes.
- Before a release, rename **Unreleased** to `## <version> (<date>)` and start a new empty **Unreleased** above it.
- Links are full URLs, since the same text goes to GitHub and Nexus.

## Unreleased

**New**

- The Saves page: every save with its picture, title, main quest, place, lifepath, V, level, Street Cred, kind, date and play time, newest first.
- Search saves by words (title, quest, place, lifepath, folder), and filter them with chips: lifepath, V's body, V's voice, difficulty, kind, playthrough, game version, Phantom Liberty, point of no return, modded. Each chip shows how many saves it leaves.
- Filters typed in the search box too: ranges for level, Street Cred, play time and the five attributes (`level:>40`), dates (`date:2026-11`), finished quests (`quest:q112`) and quest facts (`fact:q112_takemura_dead=0`); a minus leaves out what matches. **Search help** on the page lists them, and clicking an example there runs it.
- Sort by date, play time, level or title, and group by playthrough.
- Select saves with Ctrl and Shift clicks or **Select all**, and show them in Explorer.
- A save's details: every field its metadata has, with its finished quests and quest facts, each one click away from a filter.
- Quest and place names from your own copy of the game, through REDbridge (from EDGEdeck, REDcode or REDnode). Without it, saves show their quest's id.
- The side bar: Open the Saves page, the saves by kind and the playthroughs, each opening the page with its filter.
- New saves show while the game runs.
- Loadouts: sets of saves kept outside the game's save folder, in `Saved Games\REDsave` (the setting **REDsave: Library Path** for another place). Make one with the **+** on **Loadouts** in the side bar.
- Each loadout opens in its own tab, with its saves, name, notes and size. **Add saves...** there lists every save elsewhere, with the full search and filters: select, then **Add to** the loadout.
- Move a selection to a loadout or back into the game from the Saves page (**Move to loadout...**) or a loadout's tab (**Move to...**). REDsave asks once, with how many saves come from where, before anything moves.
- Moves are safe: never while the game runs (moves between loadouts excepted), nothing deleted, every move written down first and finished at the next start if VS Code closes partway, and **Undo the Last Move** puts the saves back. A save whose folder name is taken where it goes gets the next free number.
- A **Where** chip on the Saves page: the game's folder and each loadout, with counts.
