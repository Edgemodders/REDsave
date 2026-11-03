// The game's save folder, read only. Each save is a folder named by its kind and a number
// (ManualSave-12, AutoSave-3, QuickSave-0, PointOfNoReturnSave-0, EndGameSave-0) with sav.dat,
// screenshot.png and metadata.<n>.json, where <n> is the metadata format (9 in game 2.5).
// Nothing here writes to the folder.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type SaveKind = "manual" | "auto" | "quick" | "pointOfNoReturn" | "endGame";

const KINDS: Record<string, SaveKind> = {
  ManualSave: "manual",
  AutoSave: "auto",
  QuickSave: "quick",
  PointOfNoReturnSave: "pointOfNoReturn",
  EndGameSave: "endGame",
};

/** What the kinds are called in the side bar. */
export const KIND_NAMES: Record<SaveKind, string> = {
  manual: "Manual saves",
  auto: "Autosaves",
  quick: "Quick saves",
  pointOfNoReturn: "Point of no return",
  endGame: "End of the game",
};

export interface SaveFolder {
  /** The folder's name, which is also metadata's "name": ManualSave-12. */
  name: string;
  kind: SaveKind;
  dir: string;
  /** metadata.<n>.json with the highest <n>, or undefined when the save has none. */
  metadataFile?: string;
}

/** Where Steam, GOG and Epic copies of the game save: the same folder for all three. */
export function defaultSavesPath(home = os.homedir()): string {
  return path.join(home, "Saved Games", "CD Projekt Red", "Cyberpunk 2077");
}

/** A save folder's kind from its name, or undefined for anything else in the folder (user.gls, EnabledMods.json, ...). */
export function saveKind(folderName: string): SaveKind | undefined {
  const m = /^([A-Za-z]+)-\d+$/.exec(folderName);
  return m ? KINDS[m[1]] : undefined;
}

/** The newest metadata file in a save folder: metadata.9.json over metadata.8.json. */
export function metadataFileOf(names: string[]): string | undefined {
  let best: { name: string; n: number } | undefined;
  for (const name of names) {
    const m = /^metadata\.(\d+)\.json$/i.exec(name);
    if (m && (!best || Number(m[1]) > best.n)) best = { name, n: Number(m[1]) };
  }
  return best?.name;
}

/**
 * The saves in a folder, sorted by kind then number. A save folder with no sav.dat is not a save:
 * the dev PC's folder has empty ones the game left (23 of 993 on 2026-11-03). An unreadable or
 * missing folder gives none.
 */
export function listSaves(dir: string): SaveFolder[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const saves: SaveFolder[] = [];
  for (const e of entries) {
    const kind = e.isDirectory() ? saveKind(e.name) : undefined;
    if (!kind) continue;
    const saveDir = path.join(dir, e.name);
    let files: string[] = [];
    try {
      files = fs.readdirSync(saveDir);
    } catch {
      continue;
    }
    if (!files.some((f) => f.toLowerCase() === "sav.dat")) continue;
    const metadata = metadataFileOf(files);
    saves.push({ name: e.name, kind, dir: saveDir, metadataFile: metadata && path.join(saveDir, metadata) });
  }
  const number = (s: SaveFolder) => Number(s.name.slice(s.name.lastIndexOf("-") + 1));
  return saves.sort((a, b) => a.kind.localeCompare(b.kind) || number(a) - number(b));
}
