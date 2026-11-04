// The index of saves: every save folder's record, kept in REDsave's global storage and keyed by
// the folder, so a start reads only the saves that changed. A watcher on the save folder picks up
// saves the game writes while it runs. Read only: nothing here writes to a save folder.
import * as fs from "node:fs";
import * as path from "node:path";
import { listSaves } from "./saves";
import { readSave, SaveRecord } from "./metadata";

const FORMAT = 1;

interface Entry {
  stamp: string;
  record: SaveRecord;
}

/** What a save's files were when it was read: its metadata's and sav.dat's times and sizes, and its picture. */
function stampOf(dir: string, metadataFile?: string): string {
  const part = (f?: string) => {
    if (!f) return "-";
    try {
      const s = fs.statSync(f);
      return `${s.mtimeMs}:${s.size}`;
    } catch {
      return "-";
    }
  };
  return [part(metadataFile), part(path.join(dir, "sav.dat")), part(path.join(dir, "screenshot.png"))].join("|");
}

export class SaveIndex {
  private entries = new Map<string, Entry>();
  private watcher?: fs.FSWatcher;
  private timer?: NodeJS.Timeout;

  constructor(private readonly cacheFile: string) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (data.format === FORMAT) for (const [dir, e] of Object.entries(data.entries as Record<string, Entry>)) this.entries.set(dir, e);
    } catch {
      // no cache yet, or an old one: the first scan reads every save
    }
  }

  /**
   * The records of every save in a folder, reading only the saves that changed since the cache.
   * `read` counts the saves read from their files this time.
   */
  scan(savesDir: string, where = "game"): { records: SaveRecord[]; read: number; ms: number } {
    const t0 = Date.now();
    let read = 0;
    const seen = new Set<string>();
    const records: SaveRecord[] = [];
    for (const folder of listSaves(savesDir)) {
      seen.add(folder.dir);
      const stamp = stampOf(folder.dir, folder.metadataFile);
      let e = this.entries.get(folder.dir);
      if (!e || e.stamp !== stamp || e.record.where !== where) {
        e = { stamp, record: readSave(folder, where) };
        this.entries.set(folder.dir, e);
        read++;
      }
      records.push(e.record);
    }
    let removed = 0;
    for (const [dir, e] of this.entries) {
      if (e.record.where === where && !seen.has(dir)) {
        this.entries.delete(dir);
        removed++;
      }
    }
    if (read || removed) this.save();
    return { records, read, ms: Date.now() - t0 };
  }

  /** Forgets saves so the next scan reads them again (a title write keeps the file's time). */
  forget(dirs: string[]): void {
    for (const d of dirs) this.entries.delete(d);
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      const tmp = `${this.cacheFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ format: FORMAT, entries: Object.fromEntries(this.entries) }));
      fs.renameSync(tmp, this.cacheFile);
    } catch {
      // the cache only saves time; the next start reads the saves again
    }
  }

  /** Calls `changed` once things settle after the folder changes (the game writes a save as several files). */
  watch(savesDir: string, changed: () => void): void {
    this.unwatch();
    try {
      this.watcher = fs.watch(savesDir, { recursive: true }, () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(changed, 1500);
      });
      this.watcher.on("error", () => this.unwatch());
    } catch {
      // a missing folder: nothing to watch
    }
  }

  unwatch(): void {
    clearTimeout(this.timer);
    this.watcher?.close();
    this.watcher = undefined;
  }
}
