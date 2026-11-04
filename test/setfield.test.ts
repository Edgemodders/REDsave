import { test } from "node:test";
import * as assert from "node:assert/strict";
import { setField } from "../src/titles";
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

test("REDsave shows a plain-text trackedQuest as the save's title", () => {
  const folder = { name: "ManualSave-10", kind: "manual" as const, dir: "C:\\x\\ManualSave-10" };
  const r = recordFrom(JSON.parse(setField(META, "trackedQuest", "Clampdown: REDsave test A")), folder, "game", 0);
  assert.equal(titleOf(r, () => "should not be used"), "Clampdown: REDsave test A");
  const lockey = recordFrom(JSON.parse(META), folder, "game", 0);
  assert.equal(titleOf(lockey, (k) => (k === "LocKey#98600" ? "Clampdown" : undefined)), "Clampdown");
});
