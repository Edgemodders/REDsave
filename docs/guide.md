---
title: Player guide
---

# Player guide

REDsave looks after your Cyberpunk 2077 saves from inside VS Code: it finds them, keeps sets of them outside the game, and gives them titles of your own. Your saves are your own work, so REDsave never deletes one, and it moves or changes saves only while the game is closed.

## Install

1. In VS Code (or VSCodium, or EDGEkit), open the Extensions view (Ctrl+Shift+X), search for **REDsave** and install it. From a Nexus Mods download: Extensions view, **...**, **Install from VSIX...**, and pick the `.vsix` from the zip.
2. Open **REDsave** in the activity bar: the floppy disk in HUD brackets.

REDsave finds the game's save folder by itself (`Saved Games\CD Projekt Red\Cyberpunk 2077` in your user folder, the same for Steam, GOG and Epic). For quest and place names it uses REDbridge, which EDGEdeck, REDcode or REDnode install; without it, saves show their quest's id.

## Find a save

Click **Open the Saves page**. Every save shows, newest first, with its picture, title, quest and place, lifepath, V, level, Street Cred, kind, date and play time.

| To | Do |
|---|---|
| Search | Type words: a title, a quest, a place, a lifepath. All words must match |
| Filter | Click a chip: Lifepath, V's body, V's voice, Kind, Playthrough, Game version and more. Each shows how many saves it leaves; click it again to take it off |
| Filter by numbers or dates | Type `level:>40`, `cred:20-30`, `hours:<100`, `date:2026-11`, `date:>2026-10-01` |
| Find a story choice | Open a save's details, **Quest facts**, and click one, such as `q112_takemura_dead=0`: the saves with the same fact show |
| See every filter | **Search help**: click an example to run it |
| Sort or group | The sort box, and **By playthrough** |
| Select | Click, Ctrl+click, Shift+click, or **Select all** for every save shown |

The side bar's **In the game** opens the page on the game's saves, by kind or by playthrough.

## Loadouts

A loadout is a named set of saves kept in REDsave's library, `Saved Games\REDsave`, outside the game's save folder, so the game does not list them.

| To | Do |
|---|---|
| Make one | The **+** on **Loadouts** in the side bar, and a name |
| Add saves | Click the loadout: its tab opens. **Add saves...** lists every save elsewhere: search or filter, select, then **Add N to** the loadout |
| Move saves out | In the loadout's tab, select saves, **Move to...**, and pick the game or another loadout |
| Move from the Saves page | Select, **Move to loadout...**, and pick one or make a new one |
| Swap a whole set into the game | Right-click the loadout, **Swap In** (or its tab's **Swap in**). The saves in the game go to the loadout they belong to (REDsave asks for a name the first time), and this loadout's saves come into the game |
| Undo | Right-click **Loadouts**, **Undo the Last Move**, or **Undo** on the notice after a move |
| Rename, notes, remove | Right-click the loadout. A loadout is removed only when it is empty; **Move all to...** first |

The loadout in the game has a filled dot and "in the game" in the side bar, and the saves you make while it is in belong to it.

Every move asks once, with how many saves come from where. REDsave moves saves into or out of the game's folder only while the game is closed. Each move is written down before it starts: if VS Code closes partway, REDsave finishes it at the next start. A save whose folder name is taken where it goes gets the next free number; it loads as before.

**Steam Cloud** syncs the game's save folder. REDsave says so once, the first time saves leave it. In REDsave's tests, saves moved out and back caused no sync error or conflict. While saves are in a loadout they are on your PC, in REDsave's library, but not in the game's folder that Steam copies.

## Titles of your own

| To | Do |
|---|---|
| Give a save a title | Its details, **Set title...**: the box starts with its quest's name and ": ", so type your text, such as "Takemura alive" |
| Title several saves | Select them, **Add to titles...**: the same text after each one's quest name |
| Take a title off | **Reset title** in its details, or **Reset titles** for a selection |
| Find titled saves | The **Your title** chip, or `titled:yes` |

A title shows in the game's **Load Game** and in REDsave. REDsave writes it into the save's own metadata while the game is closed, and keeps the game's title in the save too, so a title can be taken off wherever the save goes. A title is plain text: its quest name stays in English whatever the game's language. Saving over a titled save in the game makes a new save with the game's title.

## Run the game

The play button at the top of REDsave's side bar, **Run Game**, starts the game: through EDGEdeck when it is installed (your pending mod changes deploy first), otherwise through Steam or the game's exe.

## Settings

| Setting | What |
|---|---|
| REDsave: Saves Path | The game's save folder. Empty: `Saved Games\CD Projekt Red\Cyberpunk 2077` |
| REDsave: Library Path | Where loadouts are kept. Empty: `Saved Games\REDsave`, on the same drive, so moves are instant |
| REDsave: Game Path | The game's folder, for names and Run Game. Empty: found through EDGEdeck, Steam, GOG or Epic |
