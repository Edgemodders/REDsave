import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resetTitle, setTitle, titleProblem } from "../src/titles";
import { recordFrom } from "../src/metadata";
import { questNameOf, search, titleOf } from "../src/search";

// As the game writes it (made-up values).
const META = [
  "{",
  '    "Data": {',
  '        "metadata": {',
  '            "trackedQuest": "LocKey#98600",',
  '            "level": 60.0,',
  '            "name": "ManualSave-7",',
  '            "userName": "",',
  '            "playTime": 448042.4048209',
  "        }",
  "    }",
  "}",
].join("\n");

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-titles-"));
  const dir = path.join(root, "game", "ManualSave-7");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "sav.dat"), "x");
  const file = path.join(dir, "metadata.9.json");
  fs.writeFileSync(file, META);
  fs.utimesSync(file, new Date(2026, 10, 3, 18, 0), new Date(2026, 10, 3, 18, 0));
  const backups = path.join(root, "library", "backups", "titles");
  const meta = () => JSON.parse(fs.readFileSync(file, "utf8")).Data.metadata;
  return { root, dir, file, backups, meta, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("a title goes into trackedQuest, the game's own into userName, with a backup and the file's time kept", () => {
  const s = scratch();
  try {
    setTitle(s.dir, "metadata.9.json", "  Clampdown: Takemura alive  ", s.backups);
    assert.deepEqual([s.meta().trackedQuest, s.meta().userName], ["Clampdown: Takemura alive", "REDsave:LocKey#98600"]);
    assert.match(fs.readFileSync(s.file, "utf8"), /"level": 60\.0,/, "every other byte as the game wrote it");
    assert.equal(fs.statSync(s.file).mtime.getHours(), 18, "the file's time kept");
    const backups = fs.readdirSync(s.backups);
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(s.backups, backups[0]), "utf8"), META, "the backup is the game's file");
    assert.ok(!fs.existsSync(`${s.file}.redsave-tmp`));

    // A second title keeps the game's own, and makes no second backup.
    setTitle(s.dir, "metadata.9.json", "Clampdown: before the heist", s.backups);
    assert.deepEqual([s.meta().trackedQuest, s.meta().userName], ["Clampdown: before the heist", "REDsave:LocKey#98600"]);
    assert.equal(fs.readdirSync(s.backups).length, 1);

    // Reset puts the game's own back, and the file is the game's again.
    assert.equal(resetTitle(s.dir, "metadata.9.json"), true);
    assert.equal(fs.readFileSync(s.file, "utf8"), META);
    assert.equal(resetTitle(s.dir, "metadata.9.json"), false, "nothing to reset");
  } finally {
    s.done();
  }
});

test("a save whose userName holds text REDsave did not write is left alone", () => {
  const s = scratch();
  try {
    fs.writeFileSync(s.file, META.replace('"userName": ""', '"userName": "someone else"'));
    assert.throws(() => setTitle(s.dir, "metadata.9.json", "x", s.backups), /did not write/);
    assert.equal(s.meta().trackedQuest, "LocKey#98600");
  } finally {
    s.done();
  }
});

test("titleProblem: one line, not empty, 120 characters at most", () => {
  assert.equal(titleProblem("Clampdown: Takemura alive"), undefined);
  assert.match(titleProblem("   ")!, /needs some text/);
  assert.match(titleProblem("a\nb")!, /one line/);
  assert.match(titleProblem("x".repeat(121))!, /120/);
});

test("REDsave shows the title, keeps the quest's own name, and finds both", () => {
  const nameOf = (k?: string) => (k === "LocKey#98600" ? "Clampdown" : undefined);
  const folder = (n: number) => ({ name: `ManualSave-${n}`, kind: "manual" as const, dir: `C:\\g\\ManualSave-${n}` });
  const titled = recordFrom(JSON.parse(META.replace('"LocKey#98600"', '"Clampdown: Takemura alive"').replace('"userName": ""', '"userName": "REDsave:LocKey#98600"')), folder(1), "game", 0);
  const plain = recordFrom(JSON.parse(META), folder(2), "game", 0);
  assert.equal(titled.originalQuest, "LocKey#98600");
  assert.equal(titleOf(titled, nameOf), "Clampdown: Takemura alive");
  assert.equal(questNameOf(titled, nameOf), "Clampdown");
  assert.equal(questNameOf(plain, nameOf), "Clampdown");
  const found = (q: string) => search([titled, plain], q, nameOf).records.map((r) => r.name);
  assert.deepEqual(found("takemura"), ["ManualSave-1"]);
  assert.deepEqual(found("clampdown"), ["ManualSave-1", "ManualSave-2"]);
  assert.deepEqual(found("titled:yes"), ["ManualSave-1"]);
  assert.deepEqual(found("titled:no"), ["ManualSave-2"]);
});
