import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SaveIndex } from "../src/index";
import { metadataJson } from "./fixture";

function makeSave(dir: string, name: string, level: number): void {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.writeFileSync(path.join(dir, name, "sav.dat"), "x");
  fs.writeFileSync(path.join(dir, name, "metadata.9.json"), JSON.stringify(metadataJson({ level })));
}

test("the index reads each save once, again only when it changed, and drops removed ones", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-test-"));
  const saves = path.join(root, "saves");
  const cache = path.join(root, "store", "index.json");
  try {
    makeSave(saves, "ManualSave-1", 10);
    makeSave(saves, "ManualSave-2", 20);
    const first = new SaveIndex(cache).scan(saves);
    assert.equal(first.read, 2);
    assert.ok(fs.existsSync(cache), "kept in the store");

    // A new start: the cache answers.
    const again = new SaveIndex(cache).scan(saves);
    assert.equal(again.read, 0);
    assert.deepEqual(again.records.map((r) => r.level), [10, 20]);

    // A changed save is read again (another size, so the stamp differs even within one clock tick).
    fs.writeFileSync(path.join(saves, "ManualSave-2", "metadata.9.json"), JSON.stringify(metadataJson({ level: 55, debugString: "changed" })));
    fs.rmSync(path.join(saves, "ManualSave-1"), { recursive: true });
    const index = new SaveIndex(cache);
    const changed = index.scan(saves);
    assert.equal(changed.read, 1);
    assert.deepEqual(changed.records.map((r) => [r.name, r.level]), [["ManualSave-2", 55]]);
    assert.equal(new SaveIndex(cache).scan(saves).read, 0, "the removed save left the cache too");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
