// S3b, titles of the player's own. The game's Load Game shows a save's metadata `trackedQuest`
// as its title, a LocKey shown in the game's language or plain text shown as written (S3a, passed
// in the game on 2026-11-03). A title is written there as plain text. The save's own quest, the
// LocKey that was there, goes into the metadata's `userName` (empty in every save seen, shown
// nowhere, harmless: S3a's copy B) as "REDsave:<LocKey>", so the original travels with the save
// and Reset Title works wherever the save is. Before a save's metadata is first changed, a copy of
// it goes into REDsave's library (backups\titles). Each write changes the two fields' text and
// nothing else, through a temporary file, with the file's time kept.
import * as fs from "node:fs";
import * as path from "node:path";
import { setField } from "./titlespike";
import { ORIGINAL_PREFIX, originalOf } from "./metadata";

export { ORIGINAL_PREFIX, originalOf };
export const MAX_TITLE = 120;

/** What a title may be: one line, not empty, at most 120 characters. Undefined when fine. */
export function titleProblem(title: string): string | undefined {
  const t = title.trim();
  if (!t) return "A title needs some text";
  if (/[\r\n]/.test(t)) return "A title is one line";
  if (t.length > MAX_TITLE) return `A title can be ${MAX_TITLE} characters at most`;
  return undefined;
}

interface Fields {
  trackedQuest: string;
  userName: string;
}

function fieldsOf(text: string): Fields {
  const m = (JSON.parse(text) as { Data?: { metadata?: Record<string, unknown> } })?.Data?.metadata ?? {};
  if (typeof m.trackedQuest !== "string") throw new Error("its metadata has no quest title (trackedQuest)");
  return { trackedQuest: m.trackedQuest, userName: typeof m.userName === "string" ? m.userName : "" };
}

/** Writes a metadata file whole through a temporary file, keeping the file's times. */
function writeKeepingTime(file: string, text: string): void {
  const st = fs.statSync(file);
  const tmp = `${file}.redsave-tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  // as numbers of seconds: a Date would drop the time's fraction of a millisecond
  fs.utimesSync(file, st.atimeMs / 1000, st.mtimeMs / 1000);
}

/** A copy of the metadata before REDsave first changes it: <backups>\<folder>-<file time>.json. */
function backUp(file: string, saveDir: string, backups: string): void {
  fs.mkdirSync(backups, { recursive: true });
  const to = path.join(backups, `${path.basename(saveDir)}-${Math.round(fs.statSync(file).mtimeMs)}-${path.basename(file)}`);
  if (!fs.existsSync(to)) fs.copyFileSync(file, to);
}

/** Gives a save a title of the player's own. */
export function setTitle(saveDir: string, metadataName: string, title: string, backups: string): void {
  const problem = titleProblem(title);
  if (problem) throw new Error(problem);
  const file = path.join(saveDir, metadataName);
  let text = fs.readFileSync(file, "utf8");
  const f = fieldsOf(text);
  if (f.userName && !originalOf(f.userName)) throw new Error(`its userName field holds text REDsave did not write ("${f.userName}"), so REDsave leaves this save alone`);
  if (!originalOf(f.userName)) {
    // the first title: keep the game's own quest title, in the save and in a backup
    backUp(file, saveDir, backups);
    text = setField(text, "userName", ORIGINAL_PREFIX + f.trackedQuest);
  }
  writeKeepingTime(file, setField(text, "trackedQuest", title.trim()));
}

/** Puts the game's own title back. Returns false when the save has no title from REDsave. */
export function resetTitle(saveDir: string, metadataName: string): boolean {
  const file = path.join(saveDir, metadataName);
  const text = fs.readFileSync(file, "utf8");
  const original = originalOf(fieldsOf(text).userName);
  if (original === undefined) return false;
  writeKeepingTime(file, setField(setField(text, "trackedQuest", original), "userName", ""));
  return true;
}
