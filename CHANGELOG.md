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
- Filters typed in the search box too: ranges for level, Street Cred, play time and the five attributes (`level:>40`), dates (`date:2026-11`), finished quests (`quest:q112`) and quest facts (`fact:q112_takemura_dead=0`); a minus leaves out what matches. **Search help** on the page lists them.
- Sort by date, play time, level or title, and group by playthrough.
- Select saves with Ctrl and Shift clicks or **Select all**, and show them in Explorer.
- A save's details: every field its metadata has, with its finished quests and quest facts, each one click away from a filter.
- Quest and place names from your own copy of the game, through REDbridge (from EDGEdeck, REDcode or REDnode). Without it, saves show their quest's id.
- The side bar: Open the Saves page, the saves by kind and the playthroughs, each opening the page with its filter.
- New saves show while the game runs. REDsave only reads your saves.
