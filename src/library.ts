// REDsave's library: the loadouts, kept outside the game's save folder (redsave.libraryPath,
// default Saved Games\REDsave). library.json holds the loadouts and the journal of the last move;
// each loadout's saves are in loadouts\<id>\, exactly as the game wrote them. Nothing here moves
// saves (move.ts does); a loadout folder is removed only when it is empty.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";

export interface Loadout {
  id: string;
  name: string;
  notes: string;
  created: number;
}

export interface MoveItem {
  from: string;
  to: string;
  state: "pending" | "done" | "failed";
  error?: string;
}

export interface Journal {
  id: string;
  at: number;
  /** What the move was, for the player: "Move 42 saves to Dogtown run". */
  label: string;
  /** running: under way, or cut short (finished at the next start); stopped: an error ended it; complete. */
  state: "running" | "stopped" | "complete";
  items: MoveItem[];
  /** Set on a move that undid another: it is not offered for undo itself. */
  undoOf?: string;
}

interface LibraryFile {
  format: 1;
  /** The loadout the game's saves belong to (S2b's swap sets it). */
  inGame: string | null;
  loadouts: Loadout[];
  journal?: Journal;
}

export const defaultLibraryPath = (home = os.homedir()) => path.join(home, "Saved Games", "REDsave");

/** Whether one folder is the other or inside it, case-insensitively as Windows paths are. */
export function within(inner: string, outer: string): boolean {
  const a = path.resolve(inner).toLowerCase();
  const b = path.resolve(outer).toLowerCase();
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

export class Library {
  private data: LibraryFile = { format: 1, inGame: null, loadouts: [] };

  constructor(readonly root: string) {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (d?.format === 1) this.data = { format: 1, inGame: d.inGame ?? null, loadouts: d.loadouts ?? [], journal: d.journal };
    } catch {
      // no library yet: made at the first loadout
    }
  }

  private get file(): string {
    return path.join(this.root, "library.json");
  }

  get loadouts(): readonly Loadout[] {
    return this.data.loadouts;
  }

  get inGame(): string | null {
    return this.data.inGame;
  }

  get journal(): Journal | undefined {
    return this.data.journal;
  }

  loadout(id: string): Loadout | undefined {
    return this.data.loadouts.find((l) => l.id === id);
  }

  dirOf(id: string): string {
    return path.join(this.root, "loadouts", id);
  }

  /** Writes library.json whole, through a temporary file, so a cut never leaves half a file. */
  save(): void {
    fs.mkdirSync(this.root, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  setJournal(j: Journal | undefined): void {
    this.data.journal = j;
    this.save();
  }

  private checkName(name: string, except?: string): string {
    const n = name.trim();
    if (!n) throw new Error("A loadout needs a name");
    if (n.length > 80) throw new Error("A loadout's name can be 80 characters at most");
    if (this.data.loadouts.some((l) => l.id !== except && l.name.toLowerCase() === n.toLowerCase())) throw new Error(`There is already a loadout called ${n}`);
    return n;
  }

  /** A new, empty loadout. Its folder's name is made from its name, so it can be found by hand. */
  create(name: string): Loadout {
    const n = this.checkName(name);
    const slug = n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "loadout";
    const id = `${slug}-${crypto.randomBytes(3).toString("hex")}`;
    fs.mkdirSync(this.dirOf(id), { recursive: true });
    const l = { id, name: n, notes: "", created: Date.now() };
    this.data.loadouts.push(l);
    this.save();
    return l;
  }

  rename(id: string, name: string): void {
    const l = this.need(id);
    l.name = this.checkName(name, id);
    this.save();
  }

  setNotes(id: string, notes: string): void {
    this.need(id).notes = notes.trim();
    this.save();
  }

  /** Removes an empty loadout and its empty folder. Anything in the folder stops it: nothing is deleted. */
  remove(id: string): void {
    const l = this.need(id);
    const dir = this.dirOf(id);
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      // the folder is gone already
    }
    if (entries.length) throw new Error(`${l.name} is not empty: move its saves out first (its folder holds ${entries.length} item${entries.length === 1 ? "" : "s"})`);
    try {
      // rmdir removes only an empty folder: Windows refuses anything else
      fs.rmdirSync(dir);
    } catch {
      // never made, or gone already
    }
    this.data.loadouts = this.data.loadouts.filter((x) => x.id !== id);
    if (this.data.inGame === id) this.data.inGame = null;
    this.save();
  }

  private need(id: string): Loadout {
    const l = this.loadout(id);
    if (!l) throw new Error("That loadout is not in the library");
    return l;
  }
}
