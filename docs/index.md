# RED<span class="y">save</span> docs

REDsave is a VS Code extension that looks after Cyberpunk 2077's save games. Find any save by its title, quest, place, date, lifepath, V's body and voice, level or playthrough. Keep sets of saves (loadouts) outside the game's save folder and swap one in before you play. Give saves titles of your own.

| Document | What it covers |
|---|---|
| [Design](design.html) | How REDsave works: the save folder and what each save's metadata says, search and filters, loadouts and the swap rules, titles, the phases and the open questions |
| [Tests](testing.html) | Every test, with its steps for running again |
| [Dev setup](dev-setup.html) | Building, packaging and releasing REDsave |
| [Changelog](changelog.html) | What changed in each release |

## Roadmap status

As of 2026-11-03. Nothing is released yet. Each phase ends with a hand test by the owner.

| Phase | Status |
|---|---|
| S0 Repo | Done 2026-11-03: the scaffold, the release workflow, the brand and the design |
| S1 Find | Done 2026-11-03: search, filters, sort, groups, selection, details and names passed the hand test (0.0.4); 0.0.5's clickable help examples await a short check |
| S2 Loadouts | S2a Library and Move done 2026-11-03 (REDsave 0.0.8); S2b Swap done 2026-11-03 (passed its hand test, Steam Cloud quiet, a renumbered save loads). REDsave 0.0.11 adds Run Game |
| S3 Titles | S3a spike done 2026-11-03: a title written into the save's metadata shows in the game and the save loads (way A). S3b next |
| S4 First release | Not started |

REDsave is not affiliated with CD Projekt RED. Source code and issues: [github.com/Edgemodders/REDsave](https://github.com/Edgemodders/REDsave)
