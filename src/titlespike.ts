// S3a, the titles spike: does the game's Load Game show a title REDsave writes into a save's
// metadata? The load list sets its title from SaveMetadataInfo.trackedQuest (a LocKey there shows
// in the game's language; plain text, unverified, as written). Unknown: whether the game reads that
// from metadata.<n>.json or from sav.dat, and whether a changed metadata file still loads. The
// spike makes copies of one save, as new save folders beside it (the original is not touched):
//   A  trackedQuest set to plain text: "<quest name>: REDsave test A"
//   B  userName (empty in every save seen) set to "REDsave test B"
// Each copy changes one field's text and nothing else: the game writes metadata with LF line ends,
// no final newline and numbers such as 60.0, which JSON.stringify would not keep.
import * as fs from "node:fs";
import * as path from "node:path";
import { namesIn, nextFree } from "./move";

/** A metadata file's text with one string field's value replaced; the rest left byte for byte. */
export function setField(text: string, field: string, value: string): string {
  const re = new RegExp(`("${field}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
  if (!re.test(text)) throw new Error(`The metadata has no ${field} field`);
  return text.replace(re, (_, head: string) => head + JSON.stringify(value));
}

export interface SpikeCopy {
  variant: "A" | "B";
  dir: string;
  what: string;
}

/** Makes the two test copies of a save folder in the same folder, with the next free numbers of its kind. */
export function makeSpikeCopies(saveDir: string, metadataName: string, questName: string): SpikeCopy[] {
  const dir = path.dirname(saveDir);
  const taken = namesIn(dir);
  const variants: { variant: "A" | "B"; field: string; value: string; what: string }[] = [
    { variant: "A", field: "trackedQuest", value: `${questName}: REDsave test A`, what: `its quest title (trackedQuest) as the plain text "${questName}: REDsave test A"` },
    { variant: "B", field: "userName", value: "REDsave test B", what: `its empty userName field as "REDsave test B", the quest title left as it is` },
  ];
  const made: SpikeCopy[] = [];
  for (const v of variants) {
    const name = nextFree(path.basename(saveDir), taken);
    taken.add(name.toLowerCase());
    const to = path.join(dir, name);
    fs.cpSync(saveDir, to, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false });
    const file = path.join(to, metadataName);
    const stamp = fs.statSync(file);
    fs.writeFileSync(file, setField(fs.readFileSync(file, "utf8"), v.field, v.value));
    // the file's times as the original's, so nothing but the field differs
    fs.utimesSync(file, stamp.atimeMs / 1000, stamp.mtimeMs / 1000);
    made.push({ variant: v.variant, dir: to, what: v.what });
  }
  return made;
}
