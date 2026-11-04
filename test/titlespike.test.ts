import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { makeSpikeCopies, setField } from "../src/titlespike";
import { recordFrom } from "../src/metadata";
import { titleOf } from "../src/search";

// As the game writes it (made-up values): 4-space indent, LF, no final newline, numbers like 60.0.
const META = [
  "{",
  '    "RootType": "saveMetadataContainer",',
  '    "Data": {',
  '        "metadata": {',
  '            "trackedQuest": "LocKey#98600",',
  '            "debugString": "a \\"quoted\\" word",',
  '            "level": 60.0,',
  '            "name": "ManualSave-7",',
  '            "userName": "",',
  '            "playTime": 448042.4048209',
  "        }",
  "    }",
  "}",
].join("\n");

test("setField replaces one string field's value and leaves every other byte", () => {
  const out = setField(META, "trackedQuest", 'Clampdown: "Takemura" alive');
  assert.equal(out, META.replace('"LocKey#98600"', '"Clampdown: \\"Takemura\\" alive"'));
  assert.equal(JSON.parse(out).Data.metadata.trackedQuest, 'Clampdown: "Takemura" alive');
  assert.match(out, /"level": 60\.0,/, "60.0 stays 60.0");
  assert.ok(!out.endsWith("\n") && !out.includes("\r"), "LF and no final newline, as the game writes it");
  assert.equal(JSON.parse(setField(META, "userName", "REDsave test B")).Data.metadata.userName, "REDsave test B");
  assert.throws(() => setField(META, "noSuchField", "x"), /no noSuchField/);
});

test("the spike makes copies A and B beside the original, which is not changed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-spike-"));
  try {
    const orig = path.join(dir, "ManualSave-7");
    fs.mkdirSync(orig);
    fs.writeFileSync(path.join(orig, "sav.dat"), "save");
    fs.writeFileSync(path.join(orig, "metadata.9.json"), META);
    fs.writeFileSync(path.join(orig, "screenshot.png"), "png");
    fs.mkdirSync(path.join(dir, "ManualSave-9")); // taken
    fs.writeFileSync(path.join(dir, "ManualSave-9", "sav.dat"), "x");
    const made = makeSpikeCopies(orig, "metadata.9.json", "Clampdown");
    assert.deepEqual(made.map((m) => [m.variant, path.basename(m.dir)]), [["A", "ManualSave-10"], ["B", "ManualSave-11"]]);
    assert.equal(fs.readFileSync(path.join(orig, "metadata.9.json"), "utf8"), META, "the original is untouched");
    const a = JSON.parse(fs.readFileSync(path.join(made[0].dir, "metadata.9.json"), "utf8")).Data.metadata;
    const b = JSON.parse(fs.readFileSync(path.join(made[1].dir, "metadata.9.json"), "utf8")).Data.metadata;
    assert.equal(a.trackedQuest, "Clampdown: REDsave test A");
    assert.equal(a.userName, "");
    assert.equal(b.trackedQuest, "LocKey#98600");
    assert.equal(b.userName, "REDsave test B");
    assert.equal(fs.readFileSync(path.join(made[0].dir, "sav.dat"), "utf8"), "save", "sav.dat copied as it is");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REDsave shows a plain-text trackedQuest as the save's title", () => {
  const folder = { name: "ManualSave-10", kind: "manual" as const, dir: "C:\\x\\ManualSave-10" };
  const r = recordFrom(JSON.parse(setField(META, "trackedQuest", "Clampdown: REDsave test A")), folder, "game", 0);
  assert.equal(titleOf(r, () => "should not be used"), "Clampdown: REDsave test A");
  const lockey = recordFrom(JSON.parse(META), folder, "game", 0);
  assert.equal(titleOf(lockey, (k) => (k === "LocKey#98600" ? "Clampdown" : undefined)), "Clampdown");
});
