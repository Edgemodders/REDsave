import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Library, within } from "../src/library";
import { moveFolder, nextFree, planMove, recover, runMove, undoPlan } from "../src/move";

/** A scratch game folder and library, with made-up saves (a sav.dat, a metadata file and a picture each). */
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redsave-move-"));
  const game = path.join(root, "game");
  const lib = new Library(path.join(root, "library"));
  fs.mkdirSync(game, { recursive: true });
  const save = (dir: string, name: string, bytes = 100) => {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
    fs.writeFileSync(path.join(dir, name, "sav.dat"), "x".repeat(bytes));
    fs.writeFileSync(path.join(dir, name, "metadata.9.json"), "{}");
    fs.writeFileSync(path.join(dir, name, "screenshot.png"), "png");
    return path.join(dir, name);
  };
  const done = () => fs.rmSync(root, { recursive: true, force: true });
  return { root, game, lib, save, done };
}
const closed = async () => false;

test("the library makes, renames and removes loadouts, and keeps them in library.json", () => {
  const s = scratch();
  try {
    const a = s.lib.create("Dogtown run");
    assert.ok(fs.existsSync(s.lib.dirOf(a.id)));
    assert.match(a.id, /^dogtown-run-[0-9a-f]{6}$/);
    assert.throws(() => s.lib.create("dogtown RUN"), /already/);
    assert.throws(() => s.lib.create("  "), /needs a name/);
    s.lib.rename(a.id, "Dogtown");
    s.lib.setNotes(a.id, "Before the heist");
    const again = new Library(s.lib.root);
    assert.deepEqual(again.loadouts.map((l) => [l.name, l.notes]), [["Dogtown", "Before the heist"]]);
    s.save(s.lib.dirOf(a.id), "ManualSave-1");
    assert.throws(() => s.lib.remove(a.id), /not empty/);
    fs.rmSync(path.join(s.lib.dirOf(a.id), "ManualSave-1"), { recursive: true });
    s.lib.remove(a.id);
    assert.equal(s.lib.loadouts.length, 0);
    assert.ok(!fs.existsSync(s.lib.dirOf(a.id)));
  } finally {
    s.done();
  }
});

test("within tells nested folders apart, without case", () => {
  assert.equal(within("C:\\Saves\\REDsave", "c:\\saves"), true);
  assert.equal(within("C:\\Saves", "C:\\Saves"), true);
  assert.equal(within("C:\\SavesOther", "C:\\Saves"), false);
});

test("nextFree gives the next number of a folder's kind", () => {
  assert.equal(nextFree("ManualSave-12", new Set(["manualsave-12", "manualsave-1000", "autosave-3000"])), "ManualSave-1001");
  assert.equal(nextFree("AutoSave-2", new Set(["autosave-2"])), "AutoSave-3");
});

test("a plan leaves saves already there, and renames ones whose names are taken", () => {
  const s = scratch();
  try {
    const l = s.lib.create("Test");
    const dir = s.lib.dirOf(l.id);
    s.save(dir, "ManualSave-5");
    const a = s.save(s.game, "ManualSave-5");
    const b = s.save(s.game, "ManualSave-6");
    const c = s.save(dir, "ManualSave-9");
    const plan = planMove([{ dir: a, where: "game" }, { dir: b, where: "game" }, { dir: c, where: l.id }], { where: l.id, dir, name: "Test" });
    assert.equal(plan.already, 1);
    assert.deepEqual(plan.items.map((i) => [path.basename(i.to), i.renamed]), [["ManualSave-10", "ManualSave-10"], ["ManualSave-6", undefined]]);
  } finally {
    s.done();
  }
});

test("a move on the same drive renames each folder, keeps every file, and writes the journal", async () => {
  const s = scratch();
  try {
    const l = s.lib.create("Test");
    const a = s.save(s.game, "ManualSave-1");
    const b = s.save(s.game, "AutoSave-0");
    fs.utimesSync(path.join(a, "sav.dat"), new Date(2024, 0, 1), new Date(2024, 0, 1));
    const plan = planMove([{ dir: a, where: "game" }, { dir: b, where: "game" }], { where: l.id, dir: s.lib.dirOf(l.id), name: "Test" });
    const r = await runMove(plan, s.lib, { label: "Move 2 saves to Test", touchesGame: true, isGameRunning: closed });
    assert.equal(r.moved, 2);
    assert.equal(r.journal.state, "complete");
    assert.ok(!fs.existsSync(a) && !fs.existsSync(b));
    const moved = path.join(s.lib.dirOf(l.id), "ManualSave-1");
    assert.deepEqual(fs.readdirSync(moved).sort(), ["metadata.9.json", "sav.dat", "screenshot.png"]);
    assert.equal(fs.statSync(path.join(moved, "sav.dat")).mtime.getFullYear(), 2024, "the file's time is kept");
    assert.equal(new Library(s.lib.root).journal?.state, "complete", "the journal is on disk");
  } finally {
    s.done();
  }
});

test("a move by copy (another drive) checks the copy, keeps times and removes the source only then", async () => {
  const s = scratch();
  try {
    const l = s.lib.create("Test");
    const a = s.save(s.game, "ManualSave-1", 5000);
    fs.utimesSync(path.join(a, "sav.dat"), new Date(2024, 0, 1), new Date(2024, 0, 1));
    const plan = planMove([{ dir: a, where: "game" }], { where: l.id, dir: s.lib.dirOf(l.id), name: "Test" });
    const r = await runMove(plan, s.lib, { label: "copy", touchesGame: true, isGameRunning: closed, forceCopy: true });
    assert.equal(r.moved, 1);
    const moved = path.join(s.lib.dirOf(l.id), "ManualSave-1");
    assert.equal(fs.statSync(path.join(moved, "sav.dat")).size, 5000);
    assert.equal(fs.statSync(path.join(moved, "sav.dat")).mtime.getFullYear(), 2024);
    assert.ok(!fs.existsSync(a));
  } finally {
    s.done();
  }
});

test("nothing moves while the game runs, or when a save has gone", async () => {
  const s = scratch();
  try {
    const l = s.lib.create("Test");
    const a = s.save(s.game, "ManualSave-1");
    const target = { where: l.id, dir: s.lib.dirOf(l.id), name: "Test" };
    await assert.rejects(runMove(planMove([{ dir: a, where: "game" }], target), s.lib, { label: "x", touchesGame: true, isGameRunning: async () => true }), /Close the game first/);
    assert.ok(fs.existsSync(a));
    // a move between loadouts does not wait for the game
    const other = s.lib.create("Other");
    const c = s.save(s.lib.dirOf(other.id), "ManualSave-7");
    const r = await runMove(planMove([{ dir: c, where: other.id }], target), s.lib, { label: "x", touchesGame: false, isGameRunning: async () => true });
    assert.equal(r.moved, 1);
    const plan = planMove([{ dir: a, where: "game" }], target);
    fs.rmSync(path.join(a, "sav.dat"));
    await assert.rejects(runMove(plan, s.lib, { label: "x", touchesGame: true, isGameRunning: closed }), /not there any more/);
    assert.ok(fs.existsSync(a), "the folder is left alone");
  } finally {
    s.done();
  }
});

test("moveFolder never overwrites", () => {
  const s = scratch();
  try {
    const a = s.save(s.game, "ManualSave-1");
    const b = s.save(s.game, "ManualSave-2");
    assert.throws(() => moveFolder(a, b), /exists already/);
    assert.ok(fs.existsSync(path.join(a, "sav.dat")) && fs.existsSync(path.join(b, "sav.dat")));
  } finally {
    s.done();
  }
});

test("a move cut short is finished from the journal, and a half-made copy beside a whole source is redone", () => {
  const s = scratch();
  try {
    const l = s.lib.create("Test");
    const dir = s.lib.dirOf(l.id);
    const a = s.save(s.game, "ManualSave-1");
    const b = s.save(s.game, "ManualSave-2");
    const c = s.save(s.game, "ManualSave-3");
    // as if VS Code closed partway: a moved, b not yet, c half copied
    fs.renameSync(a, path.join(dir, "ManualSave-1"));
    fs.mkdirSync(path.join(dir, "ManualSave-3"));
    fs.writeFileSync(path.join(dir, "ManualSave-3", "sav.dat"), "x");
    s.lib.setJournal({
      id: "j1",
      at: 0,
      label: "Move 3 saves to Test",
      state: "running",
      items: [
        { from: a, to: path.join(dir, "ManualSave-1"), state: "done" },
        { from: b, to: path.join(dir, "ManualSave-2"), state: "pending" },
        { from: c, to: path.join(dir, "ManualSave-3"), state: "pending" },
      ],
    });
    const lib = new Library(s.lib.root);
    const r = recover(lib);
    assert.deepEqual(r && { finished: r.finished, failed: r.failed.length }, { finished: 2, failed: 0 });
    assert.equal(lib.journal?.state, "complete");
    assert.equal(fs.readFileSync(path.join(dir, "ManualSave-3", "sav.dat"), "utf8"), "x".repeat(100), "the whole save, not the half copy");
    assert.ok(!fs.existsSync(b) && !fs.existsSync(c));
    assert.equal(recover(lib), undefined, "nothing left to finish");
  } finally {
    s.done();
  }
});

test("undo puts the last move's saves back, with a new number if their name was taken since", async () => {
  const s = scratch();
  try {
    const l = s.lib.create("Test");
    const a = s.save(s.game, "ManualSave-1");
    const b = s.save(s.game, "ManualSave-2");
    await runMove(planMove([{ dir: a, where: "game" }, { dir: b, where: "game" }], { where: l.id, dir: s.lib.dirOf(l.id), name: "Test" }), s.lib, { label: "Move 2 saves to Test", touchesGame: true, isGameRunning: closed });
    s.save(s.game, "ManualSave-1"); // the game saved again under that name
    const u = undoPlan(s.lib)!;
    assert.equal(u.label, "Undo: Move 2 saves to Test");
    assert.deepEqual(u.items.map((i) => path.basename(i.to)), ["ManualSave-3", "ManualSave-2"]);
    await runMove({ target: { where: "", dir: "", name: "" }, items: u.items, already: 0 }, s.lib, { label: u.label, touchesGame: true, isGameRunning: closed, undoOf: u.of });
    assert.deepEqual(fs.readdirSync(s.game).sort(), ["ManualSave-1", "ManualSave-2", "ManualSave-3"]);
    assert.deepEqual(fs.readdirSync(s.lib.dirOf(l.id)), []);
    assert.equal(undoPlan(s.lib), undefined, "an undo is not undone again");
  } finally {
    s.done();
  }
});
