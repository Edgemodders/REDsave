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
  /** A swap: the loadout in the game before and after. Set on the library when the move completes. */
  inGame?: { before: string | null; after: string | null };
}

interface LibraryFile {
  format: 1;
  /** The loadout the game's saves belong to (S2b's swap sets it). */
  inGame: string | null;
  loadouts: Loadout[];
  journal?: Journal;
  /** Loadouts removed lately, so an undo into one (or a folder of one found again) gets its name back. */
  removed?: Loadout[];
}

export const defaultLibraryPath = (home = os.homedir()) => path.join(home, "Saved Games", "REDsave");

/**
 * Whether one folder is the other or inside it, case-insensitively as Windows paths are. Windows'
 * path rules always (REDsave runs on Windows; the Check workflow runs the tests on Linux).
 */
export function within(inner: string, outer: string): boolean {
  const w = path.win32;
  const a = w.resolve(inner).toLowerCase();
  const b = w.resolve(outer).toLowerCase();
  return a === b || a.startsWith(b.endsWith(w.sep) ? b : b + w.sep);
}

export class Library {
  private data: LibraryFile = { format: 1, inGame: null, loadouts: [] };

  constructor(readonly root: string) {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (d?.format === 1) this.data = { format: 1, inGame: d.inGame ?? null, loadouts: d.loadouts ?? [], journal: d.journal, removed: d.removed ?? [] };
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

  /** Which loadout the game's saves belong to (a swap sets it). */
  setInGame(id: string | null): void {
    this.data.inGame = id;
    this.save();
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
    this.data.removed = [l, ...(this.data.removed ?? []).filter((x) => x.id !== id)].slice(0, 50);
    this.save();
  }

  /**
   * Lists again every folder in loadouts\ that holds anything but is not in the list: a removed
   * loadout an undo moved saves back into, or a library.json lost or edited by hand. A removed
   * loadout gets its name and notes back; any other folder a name made from its folder's name.
   * Empty folders that are not loadouts are removed (rmdir, so only empty ones). Returns the
   * loadouts listed again, with how many items their folders hold.
   */
  adopt(): { loadout: Loadout; items: number }[] {
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(path.join(this.root, "loadouts"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
    const found: { loadout: Loadout; items: number }[] = [];
    for (const id of dirs) {
      if (this.loadout(id)) continue;
      const dir = this.dirOf(id);
      const items = fs.readdirSync(dir).length;
      if (!items) {
        try {
          fs.rmdirSync(dir);
        } catch {
          // in use: left for next time
        }
        continue;
      }
      const old = this.data.removed?.find((x) => x.id === id);
      let name = old?.name ?? (id.replace(/-[0-9a-f]{6}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || id);
      if (this.data.loadouts.some((x) => x.name.toLowerCase() === name.toLowerCase())) name = `${name} (found again)`;
      const note = `Listed again by REDsave on ${new Date().toISOString().slice(0, 10)}: its folder held saves but it was not in the list.`;
      const l: Loadout = { id, name, notes: old?.notes ? `${old.notes}\n${note}` : note, created: old?.created ?? Date.now() };
      this.data.loadouts.push(l);
      this.data.removed = (this.data.removed ?? []).filter((x) => x.id !== id);
      found.push({ loadout: l, items });
    }
    if (found.length) this.save();
    return found;
  }

  private need(id: string): Loadout {
    const l = this.loadout(id);
    if (!l) throw new Error("That loadout is not in the library");
    return l;
  }
}
