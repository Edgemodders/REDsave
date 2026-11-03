import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { defaultSavesPath, listSaves, metadataFileOf, saveKind } from "../src/saves";

test("saveKind reads each kind of save folder and nothing else", () => {
  assert.equal(saveKind("ManualSave-12"), "manual");
  assert.equal(saveKind("AutoSave-0"), "auto");
  assert.equal(saveKind("QuickSave-3"), "quick");
  assert.equal(saveKind("PointOfNoReturnSave-0"), "pointOfNoReturn");
  assert.equal(saveKind("EndGameSave-1"), "endGame");
  for (const other of ["user.gls", "EnabledMods.json", "ManualSave", "ManualSave-x", "OtherSave-1"]) assert.equal(saveKind(other), undefined, other);
});

test("metadataFileOf takes the newest metadata format", () => {
  assert.equal(metadataFileOf(["sav.dat", "metadata.8.json", "metadata.9.json", "screenshot.png"]), "metadata.9.json");
  assert.equal(metadataFileOf(["sav.dat"]), undefined);
});

test("defaultSavesPath is under Saved Games", () => {
  assert.equal(defaultSavesPath("C:\\Users\\V"), path.join("C:\\Users\\V", "Saved Games", "CD Projekt Red", "Cyberpunk 2077"));
});

test("listSaves lists save folders sorted by kind and number, and a missing folder as none", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-test-"));
  try {
    for (const name of ["ManualSave-10", "ManualSave-2", "AutoSave-1"]) {
      fs.mkdirSync(path.join(dir, name));
      fs.writeFileSync(path.join(dir, name, "sav.dat"), "");
      fs.writeFileSync(path.join(dir, name, "metadata.9.json"), "{}");
    }
    fs.mkdirSync(path.join(dir, "QuickSave-0"));
    fs.writeFileSync(path.join(dir, "QuickSave-0", "sav.dat"), "");
    // An empty save folder, as the game leaves them: not a save.
    fs.mkdirSync(path.join(dir, "AutoSave-3"));
    fs.writeFileSync(path.join(dir, "user.gls"), "");
    const saves = listSaves(dir);
    assert.deepEqual(saves.map((s) => s.name), ["AutoSave-1", "ManualSave-2", "ManualSave-10", "QuickSave-0"]);
    assert.equal(saves[1].metadataFile, path.join(dir, "ManualSave-2", "metadata.9.json"));
    assert.equal(saves[3].metadataFile, undefined);
    assert.deepEqual(listSaves(path.join(dir, "missing")), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
