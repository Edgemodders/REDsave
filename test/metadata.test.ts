import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseTimestamp, questIdOf, readSave, recordFrom } from "../src/metadata";
import { listSaves } from "../src/saves";
import { metadataJson } from "./fixture";

test("parseTimestamp reads the game's time, then day.month.year", () => {
  assert.equal(parseTimestamp("18:03:12, 3.11.2026"), new Date(2026, 10, 3, 18, 3, 12).getTime());
  assert.equal(parseTimestamp("9:05:00, 25.12.2024"), new Date(2024, 11, 25, 9, 5, 0).getTime());
  for (const other of [undefined, "", "2026-11-03 18:03", "18:03:12, 13.13.2026"]) assert.equal(parseTimestamp(other), undefined, String(other));
});

test("questIdOf takes the quest's folder from trackedQuestEntry", () => {
  assert.equal(questIdOf("quests/minor_quest/mq062_clampdown/mq062_hook/x"), "mq062_clampdown");
  assert.equal(questIdOf(undefined), undefined);
});

test("recordFrom reads every field, and leaves missing ones unknown", () => {
  const folder = { name: "ManualSave-1", kind: "manual" as const, dir: "C:\\saves\\ManualSave-1", metadataFile: "C:\\saves\\ManualSave-1\\metadata.9.json" };
  const r = recordFrom(metadataJson(), folder, "game", 1);
  assert.equal(r.time, new Date(2026, 10, 3, 18, 3, 12).getTime());
  assert.equal(r.questId, "mq062_clampdown");
  assert.equal(r.lifePath, "Corporate");
  assert.equal(r.body, "Female");
  assert.equal(r.voice, "Male");
  assert.deepEqual(r.attributes, { body: 5, intelligence: 6, reflexes: 7, technical: 8, cool: 9 });
  assert.equal(r.phantomLiberty, true);
  assert.deepEqual(r.finishedQuests, ["q000", "q001", "q003"]);
  assert.deepEqual(r.facts, ["q003_anthony_won=1", "player_drunk=0"]);
  assert.equal(r.metadataFile, "metadata.9.json");

  const bare = recordFrom({ Data: { metadata: { timestampString: "nonsense" } } }, folder, "game", 42);
  assert.equal(bare.time, 42, "the file's time when the timestamp cannot be read");
  for (const k of ["lifePath", "body", "level", "phantomLiberty", "modded", "attributes"] as const) assert.equal(bare[k], undefined, k);
  assert.deepEqual(bare.finishedQuests, []);
});

test("readSave reads a folder, and says so when its metadata is broken", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-test-"));
  try {
    for (const [name, meta] of [["ManualSave-1", JSON.stringify(metadataJson())], ["ManualSave-2", "{ not json"]]) {
      fs.mkdirSync(path.join(dir, name));
      fs.writeFileSync(path.join(dir, name, "sav.dat"), "");
      fs.writeFileSync(path.join(dir, name, "metadata.9.json"), meta);
    }
    fs.writeFileSync(path.join(dir, "ManualSave-1", "screenshot.png"), "");
    const [good, bad] = listSaves(dir).map((f) => readSave(f));
    assert.equal(good.level, 12);
    assert.equal(good.screenshot, path.join(dir, "ManualSave-1", "screenshot.png"));
    assert.equal(good.problem, undefined);
    assert.match(bad.problem ?? "", /could not be read/);
    assert.equal(bad.screenshot, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
