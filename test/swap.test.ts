import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Library } from "../src/library";
import { moveFolder, namesIn, planMove, planSwap, recover, runMove, undoPlan } from "../src/move";

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-swap-"));
  const game = path.join(root, "game");
  const lib = new Library(path.join(root, "library"));
  fs.mkdirSync(game, { recursive: true });
  const save = (dir: string, name: string) => {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
    fs.writeFileSync(path.join(dir, name, "sav.dat"), "x");
    fs.writeFileSync(path.join(dir, name, "metadata.9.json"), "{}");
    return path.join(dir, name);
  };
  return { root, game, lib, save, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}
const closed = async () => false;
const names = (dir: string) => fs.readdirSync(dir).sort();

test("empty save folders the game left do not take a name, and a move takes their place", () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.join(s.game, "AutoSave-3"));
    s.save(s.game, "AutoSave-4");
    assert.deepEqual([...namesIn(s.game)], ["autosave-4"]);
    const l = s.lib.create("A");
    const a = s.save(s.lib.dirOf(l.id), "AutoSave-3");
    moveFolder(a, path.join(s.game, "AutoSave-3"));
    assert.ok(fs.existsSync(path.join(s.game, "AutoSave-3", "sav.dat")));
    const plan = planMove([{ dir: s.save(s.lib.dirOf(l.id), "AutoSave-9"), where: l.id }], { where: "game", dir: s.game, name: "the game" });
    assert.equal(plan.items[0].renamed, undefined);
  } finally {
    s.done();
  }
});

test("a swap moves the game's saves out, then the loadout's in, without renaming names that are leaving", async () => {
  const s = scratch();
  try {
    const main = s.lib.create("Main");
    const dog = s.lib.create("Dogtown run");
    const g1 = s.save(s.game, "ManualSave-1");
    const g2 = s.save(s.game, "AutoSave-0");
    fs.writeFileSync(path.join(s.game, "user.gls"), "settings");
    const d1 = s.save(s.lib.dirOf(dog.id), "ManualSave-1");
    const d2 = s.save(s.lib.dirOf(dog.id), "ManualSave-2");
    const plan = planSwap(
      [{ dir: g1, where: "game" }, { dir: g2, where: "game" }],
      { where: main.id, dir: s.lib.dirOf(main.id), name: "Main" },
      [{ dir: d1, where: dog.id }, { dir: d2, where: dog.id }],
      { where: "game", dir: s.game, name: "the game" },
    );
    assert.deepEqual(plan.items.map((i) => i.renamed), [undefined, undefined, undefined, undefined], "ManualSave-1 leaves before Dogtown's comes in");
    const r = await runMove(plan, s.lib, { label: "Swap in Dogtown run", touchesGame: true, isGameRunning: closed, inGame: { before: null, after: dog.id } });
    assert.equal(r.moved, 4);
    assert.deepEqual(names(s.game), ["ManualSave-1", "ManualSave-2", "user.gls"], "the game's own files stay");
    assert.deepEqual(names(s.lib.dirOf(main.id)), ["AutoSave-0", "ManualSave-1"]);
    assert.deepEqual(names(s.lib.dirOf(dog.id)), []);
    assert.equal(new Library(s.lib.root).inGame, dog.id, "Dogtown run is in the game, kept in library.json");

    // Undo swaps back, and puts back which loadout is in the game.
    const u = undoPlan(s.lib)!;
    assert.deepEqual(u.inGame, { before: dog.id, after: null });
    await runMove({ target: { where: "", dir: "", name: "" }, items: u.items, already: 0 }, s.lib, { label: u.label, touchesGame: true, isGameRunning: closed, undoOf: u.of, inGame: u.inGame });
    assert.deepEqual(names(s.game), ["AutoSave-0", "ManualSave-1", "user.gls"]);
    assert.deepEqual(names(s.lib.dirOf(dog.id)), ["ManualSave-1", "ManualSave-2"]);
    assert.equal(s.lib.inGame, null);
  } finally {
    s.done();
  }
});

test("a swap that stops partway leaves the loadout in the game as it was", async () => {
  const s = scratch();
  try {
    const main = s.lib.create("Main");
    const dog = s.lib.create("Dogtown run");
    s.lib.setInGame(main.id);
    const g1 = s.save(s.game, "ManualSave-1");
    const d1 = s.save(s.lib.dirOf(dog.id), "ManualSave-5");
    const plan = planSwap([{ dir: g1, where: "game" }], { where: main.id, dir: s.lib.dirOf(main.id), name: "Main" }, [{ dir: d1, where: dog.id }], { where: "game", dir: s.game, name: "the game" });
    // something already in the way of the incoming save: the move stops there
    fs.mkdirSync(path.join(s.game, "ManualSave-5"));
    fs.writeFileSync(path.join(s.game, "ManualSave-5", "other.txt"), "not a save");
    const r = await runMove(plan, s.lib, { label: "Swap in Dogtown run", touchesGame: true, isGameRunning: closed, inGame: { before: main.id, after: dog.id } });
    assert.ok(r.error, "stopped");
    assert.equal(r.moved, 1);
    assert.equal(s.lib.inGame, main.id, "unchanged until the whole swap completes");
  } finally {
    s.done();
  }
});

test("a swap cut short is finished at the next start, and then sets the loadout in the game", () => {
  const s = scratch();
  try {
    const dog = s.lib.create("Dogtown run");
    const d1 = s.save(s.lib.dirOf(dog.id), "ManualSave-5");
    s.lib.setJournal({ id: "j", at: 0, label: "Swap in Dogtown run", state: "running", items: [{ from: d1, to: path.join(s.game, "ManualSave-5"), state: "pending" }], inGame: { before: null, after: dog.id } });
    const lib = new Library(s.lib.root);
    const r = recover(lib);
    assert.equal(r?.finished, 1);
    assert.equal(lib.inGame, dog.id);
  } finally {
    s.done();
  }
});
