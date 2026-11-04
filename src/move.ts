// Moving save folders between the game's save folder and the loadouts (the swap rules in
// docs/design.md, "Loadouts (S2)"):
//   1. Checks first, nothing moved yet: the game closed when the game's folder is touched, every
//      source still a save (sav.dat), room on the target's drive when it is another drive.
//   2. The journal: the whole move in library.json before the first folder moves.
//   3. Each folder: one rename on the same drive; on another drive a copy, checked file by file,
//      then the source removed.
//   4. A name taken in the target: the next free number of its kind.
//   5. A move cut short is finished at the next start from the journal (recover).
// Nothing here deletes a save: a source is removed only once its copy checks out.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execFile } from "node:child_process";
import type { Journal, Library, MoveItem } from "./library";

export interface Place {
  /** "game" or a loadout's id. */
  where: string;
  dir: string;
  name: string;
}

export interface PlanItem {
  from: string;
  to: string;
  /** Where the save comes from: "game" or a loadout's id. */
  source: string;
  /** Set when the save gets a new folder name in the target. */
  renamed?: string;
}

export interface MovePlan {
  target: Place;
  items: PlanItem[];
  /** Saves already in the target, left alone. */
  already: number;
}

const folderNumber = /^([A-Za-z]+)-(\d+)$/;

/** The next free name of a save folder's kind among the taken names: ManualSave-1001 after ManualSave-1000. */
export function nextFree(name: string, taken: Set<string>): string {
  const m = folderNumber.exec(name);
  const prefix = m ? m[1] : name;
  let max = -1;
  for (const t of taken) {
    const k = folderNumber.exec(t);
    if (k && k[1].toLowerCase() === prefix.toLowerCase()) max = Math.max(max, Number(k[2]));
  }
  return `${prefix}-${max + 1}`;
}

/** The names in a folder, lower case: save folders and anything else, since a target name must be free of all. */
function namesIn(dir: string): Set<string> {
  try {
    return new Set(fs.readdirSync(dir).map((n) => n.toLowerCase()));
  } catch {
    return new Set();
  }
}

/** What a move would do, without doing it. */
export function planMove(sources: { dir: string; where: string }[], target: Place): MovePlan {
  const taken = namesIn(target.dir);
  const items: PlanItem[] = [];
  let already = 0;
  for (const s of sources) {
    if (s.where === target.where) {
      already++;
      continue;
    }
    const name = path.basename(s.dir);
    let to = name;
    if (taken.has(name.toLowerCase())) to = nextFree(name, taken);
    taken.add(to.toLowerCase());
    items.push({ from: s.dir, to: path.join(target.dir, to), source: s.where, renamed: to !== name ? to : undefined });
  }
  return { target, items, already };
}

/** Whether Cyberpunk 2077 is running. */
export function gameRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("tasklist.exe", ["/FI", "IMAGENAME eq Cyberpunk2077.exe", "/NH", "/FO", "CSV"], { windowsHide: true }, (err, out) => resolve(!err && /cyberpunk2077\.exe/i.test(out)));
  });
}

function folderSize(dir: string): number {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? folderSize(p) : fs.statSync(p).size;
  }
  return total;
}

/** Every file under a folder with its size, by path inside it. */
function filesOf(dir: string, base = dir, out = new Map<string, number>()): Map<string, number> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) filesOf(p, base, out);
    else out.set(path.relative(base, p).toLowerCase(), fs.statSync(p).size);
  }
  return out;
}

/** Whether two places are on the same drive, so a move is a rename. */
export function sameDrive(a: string, b: string): boolean {
  return path.parse(path.resolve(a)).root.toLowerCase() === path.parse(path.resolve(b)).root.toLowerCase();
}

/** Moves one save folder. A rename when it can; else a checked copy, then the source removed. */
export function moveFolder(from: string, to: string, forceCopy = false): void {
  if (fs.existsSync(to)) throw new Error(`${to} exists already`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (!forceCopy && sameDrive(from, to)) {
    fs.renameSync(from, to);
    return;
  }
  fs.cpSync(from, to, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false });
  const a = filesOf(from);
  const b = filesOf(to);
  for (const [f, size] of a) {
    if (b.get(f) !== size) {
      fs.rmSync(to, { recursive: true, force: true }); // the bad copy only; the source is untouched
      throw new Error(`The copy of ${path.basename(from)} did not check out (${f}); the save was left where it was`);
    }
  }
  fs.rmSync(from, { recursive: true, force: true });
}

export interface MoveOptions {
  label: string;
  /** Whether the game's save folder is a source or the target: then the game must be closed. */
  touchesGame: boolean;
  isGameRunning?: () => Promise<boolean>;
  /** Tests: copy even on the same drive. */
  forceCopy?: boolean;
  undoOf?: string;
  progress?: (done: number, total: number) => void;
}

export interface MoveResult {
  moved: number;
  journal: Journal;
  /** Set when an error stopped the move partway: the saves moved so far stay moved, and Undo puts them back. */
  error?: string;
}

/** Runs a plan: the checks, the journal, then each folder. */
export async function runMove(plan: MovePlan, lib: Library, opts: MoveOptions): Promise<MoveResult> {
  if (!plan.items.length) throw new Error("Nothing to move: the saves are there already");
  if (opts.touchesGame && (await (opts.isGameRunning ?? gameRunning)())) throw new Error("Cyberpunk 2077 is running. Close the game first: REDsave moves saves into or out of the game's folder only while it is closed.");
  const notSaves = plan.items.filter((i) => !fs.existsSync(path.join(i.from, "sav.dat")));
  if (notSaves.length) throw new Error(`${notSaves.length} of the saves are not there any more (no sav.dat): ${notSaves.slice(0, 3).map((i) => path.basename(i.from)).join(", ")}. Refresh and try again.`);
  const copied = plan.items.filter((i) => opts.forceCopy || !sameDrive(i.from, i.to));
  // Room on each drive a copy goes to (an undo can send saves to several places).
  const need = new Map<string, { dir: string; bytes: number }>();
  for (const i of copied) {
    const dir = path.dirname(i.to);
    const drive = path.parse(path.resolve(dir)).root.toLowerCase();
    const n = need.get(drive) ?? { dir, bytes: 0 };
    n.bytes += folderSize(i.from);
    need.set(drive, n);
  }
  for (const { dir, bytes } of need.values()) {
    fs.mkdirSync(dir, { recursive: true });
    const st = fs.statfsSync(dir);
    const free = st.bavail * st.bsize;
    if (free < bytes * 1.05) throw new Error(`Not enough room on ${path.parse(path.resolve(dir)).root}: ${(bytes / 1e9).toFixed(1)} GB needed, ${(free / 1e9).toFixed(1)} GB free`);
  }
  const journal: Journal = {
    id: crypto.randomBytes(6).toString("hex"),
    at: Date.now(),
    label: opts.label,
    state: "running",
    items: plan.items.map((i) => ({ from: i.from, to: i.to, state: "pending" })),
    undoOf: opts.undoOf,
  };
  lib.setJournal(journal);
  let moved = 0;
  for (const item of journal.items) {
    try {
      moveFolder(item.from, item.to, opts.forceCopy);
      item.state = "done";
      moved++;
    } catch (err) {
      item.state = "failed";
      item.error = (err as Error).message;
      journal.state = "stopped";
      lib.save();
      return { moved, journal, error: `${item.error}. ${moved} of ${journal.items.length} saves were moved before it; Undo puts them back.` };
    }
    lib.save();
    opts.progress?.(moved, journal.items.length);
  }
  journal.state = "complete";
  lib.save();
  return { moved, journal };
}

/**
 * Finishes a move cut short (the journal still "running": VS Code closed or the PC went off
 * partway). A save still at its source is moved; a half-made copy beside a whole source is removed
 * first. Returns what was done, or undefined when there was nothing to finish.
 */
export function recover(lib: Library): { finished: number; failed: MoveItem[]; label: string } | undefined {
  const j = lib.journal;
  if (!j || j.state !== "running") return undefined;
  let finished = 0;
  const failed: MoveItem[] = [];
  for (const item of j.items) {
    if (item.state === "done") continue;
    const sourceWhole = fs.existsSync(path.join(item.from, "sav.dat"));
    const targetThere = fs.existsSync(item.to);
    try {
      if (sourceWhole) {
        // a rename never leaves both; both means a copy to another drive was cut short
        if (targetThere) fs.rmSync(item.to, { recursive: true, force: true });
        moveFolder(item.from, item.to);
        finished++;
      } else if (!targetThere) {
        throw new Error("the save is in neither place");
      }
      item.state = "done";
    } catch (err) {
      item.state = "failed";
      item.error = (err as Error).message;
      failed.push(item);
    }
  }
  j.state = failed.length ? "stopped" : "complete";
  lib.save();
  return { finished, failed, label: j.label };
}

/** The plan that puts the last move's saves back where they came from, or undefined when there is nothing to undo. */
export function undoPlan(lib: Library): { items: PlanItem[]; label: string; of: string } | undefined {
  const j = lib.journal;
  if (!j || j.undoOf || j.state === "running") return undefined;
  const done = j.items.filter((i) => i.state === "done");
  if (!done.length) return undefined;
  const takenIn = new Map<string, Set<string>>();
  const takenOf = (dir: string) => {
    if (!takenIn.has(dir)) takenIn.set(dir, namesIn(dir));
    return takenIn.get(dir)!;
  };
  // First every save whose old name is still free gets it back; only then do the others get new
  // numbers, so a new number never takes another returning save's own name.
  const names = done.map((i) => {
    const name = path.basename(i.from);
    const taken = takenOf(path.dirname(i.from));
    if (taken.has(name.toLowerCase())) return undefined;
    taken.add(name.toLowerCase());
    return name;
  });
  const items: PlanItem[] = done.map((i, n) => {
    const dir = path.dirname(i.from);
    let name = names[n];
    if (!name) {
      name = nextFree(path.basename(i.from), takenOf(dir));
      takenOf(dir).add(name.toLowerCase());
    }
    return { from: i.to, to: path.join(dir, name), source: "", renamed: name !== path.basename(i.from) ? name : undefined };
  });
  return { items, label: `Undo: ${j.label}`, of: j.id };
}
