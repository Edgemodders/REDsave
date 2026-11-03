import { test } from "node:test";
import * as assert from "node:assert/strict";
import { recordFrom, SaveRecord } from "../src/metadata";
import { inRange, onDate, parseQuery, playthroughsOf, search, titleOf, toggleChip } from "../src/search";
import { metadataJson } from "./fixture";

const NAMES: Record<string, string> = { "LocKey#98600": "Clampdown", "LocKey#9860": "Nocturne Op55N1", "LocKey#10963": "Little China", "LocKey#1": "The Heist", "LocKey#2": "Watson" };
const nameOf = (k?: string) => (k ? NAMES[k] : undefined);
let n = 0;
function save(over: Record<string, unknown>, kind: SaveRecord["kind"] = "manual"): SaveRecord {
  const name = `${kind === "manual" ? "ManualSave" : "AutoSave"}-${++n}`;
  return recordFrom(metadataJson(over), { name, kind, dir: `C:\\saves\\${name}` }, "game", 0);
}

const corpoA = save({ timestampString: "10:00:00, 1.10.2026", level: 10, playthroughID: "p1" });
const corpoB = save({ timestampString: "10:00:00, 2.11.2026", level: 45, trackedQuest: "LocKey#1", locationName: "LocKey#2", playthroughID: "p1", facts: ["q112_takemura_dead=0"] });
const nomad = save({ timestampString: "10:00:00, 3.11.2026", lifePath: "Nomad", bodyGender: "Male", brainGender: "Male", level: 30, playthroughID: "p2", additionalContentIds: [], finishedQuests: "q112 q113" });
const kid = save({ timestampString: "10:00:00, 5.09.2026", lifePath: "StreetKid", trackedQuest: undefined, trackedQuestEntry: undefined, playthroughID: "p3", playTime: 400000 }, "auto");
const all = [corpoA, corpoB, nomad, kid];
const found = (q: string) => search(all, q, nameOf).records.map((r) => r.name);

test("parseQuery splits words, filters, quotes and minus", () => {
  assert.deepEqual(parseQuery(`corpo -kind:auto lifepath:"street kid" 12:30`), [
    { key: undefined, value: "corpo", not: false },
    { key: "kind", value: "auto", not: true },
    { key: "lifepath", value: "street kid", not: false },
    { key: undefined, value: "12:30", not: false },
  ]);
});

test("words match the title, place and lifepath, all of them, any case and accents", () => {
  assert.deepEqual(found("heist"), [corpoB.name]);
  assert.deepEqual(found("LITTLE china"), [nomad.name, corpoA.name, kid.name]);
  assert.deepEqual(found("corpo watson"), [corpoB.name]);
  assert.deepEqual(found("nómad"), [nomad.name]);
  assert.deepEqual(found("nothing-like-this"), []);
});

test("chips: one key matches any of its values, two keys both", () => {
  assert.deepEqual(found("lifepath:nomad lifepath:streetkid"), [nomad.name, kid.name]);
  assert.deepEqual(found("lifepath:corpo gender:male"), []);
  assert.deepEqual(found("voice:male gender:female"), [corpoB.name, corpoA.name, kid.name]);
  assert.deepEqual(found("kind:auto"), [kid.name]);
  assert.deepEqual(found("-kind:auto pl:no"), [nomad.name]);
  assert.deepEqual(found(`lifepath:"street kid"`), [kid.name]);
});

test("playthroughs are numbered by their first save, and filter by number", () => {
  const p = playthroughsOf(all);
  assert.equal(p.get("p3")!.number, 1);
  assert.equal(p.get("p1")!.number, 2);
  assert.equal(p.get("p1")!.count, 2);
  assert.deepEqual(found("playthrough:2"), [corpoB.name, corpoA.name]);
});

test("ranges, dates, quests and facts", () => {
  assert.deepEqual(found("level:>20"), [nomad.name, corpoB.name]);
  assert.deepEqual(found("level:10-30"), [nomad.name, corpoA.name, kid.name]);
  assert.deepEqual(found("hours:>100"), [kid.name]);
  assert.deepEqual(found("date:2026-11"), [nomad.name, corpoB.name]);
  assert.deepEqual(found("date:<2026-10"), [kid.name]);
  assert.deepEqual(found("date:>2026-10"), [nomad.name, corpoB.name]);
  assert.deepEqual(found("quest:q112"), [nomad.name]);
  assert.deepEqual(found("fact:q112_takemura_dead=0"), [corpoB.name]);
  assert.deepEqual(found("fact:q112_takemura_dead=1"), []);
  assert.deepEqual(found("-fact:q112_takemura_dead"), [nomad.name, corpoA.name, kid.name]);
  assert.equal(inRange(undefined, ">1"), false);
  assert.equal(inRange(5, "x"), false);
  assert.equal(onDate(new Date(2026, 10, 3).getTime(), "2026-11-03"), true);
});

test("chips count what the other filters leave, with their own key left out", () => {
  const r = search(all, "lifepath:nomad level:>20", nameOf);
  const life = Object.fromEntries(r.facets.lifepath.map((f) => [f.value, [f.count, f.active]]));
  assert.deepEqual(life, { corpo: [1, false], nomad: [1, true], streetkid: [0, false] });
  const kinds = Object.fromEntries(r.facets.kind.map((f) => [f.value, f.count]));
  assert.deepEqual(kinds, { manual: 1, auto: 0 });
});

test("sort, and the title when no name is known", () => {
  assert.deepEqual(search(all, "", nameOf, "level").records.map((r) => r.level), [45, 30, 12, 10]);
  assert.deepEqual(search(all, "", nameOf, "oldest").records[0].name, kid.name);
  assert.equal(titleOf(corpoA, nameOf), "Clampdown");
  assert.equal(titleOf(corpoA, () => undefined), "mq062 clampdown");
  assert.equal(titleOf(kid, nameOf), "Autosave");
});

test("game versions sort newest first, read as decimals (2.5 after 2.31)", () => {
  const v = ["2.31", "2.5", "2.13", "2.2", "2.1"].map((patch) => save({ buildPatch: patch }));
  assert.deepEqual(search(v, "", nameOf).facets.version.map((f) => f.value), ["2.5", "2.31", "2.2", "2.13", "2.1"]);
});

test("toggleChip adds and removes a filter, keeping the rest", () => {
  assert.equal(toggleChip("takemura", "lifepath", "corpo"), "takemura lifepath:corpo");
  assert.equal(toggleChip("takemura lifepath:corpo level:>3", "lifepath", "corpo"), "takemura level:>3");
  assert.equal(toggleChip("", "lifepath", "street kid"), `lifepath:"street kid"`);
  assert.equal(toggleChip(`lifepath:"street kid"`, "lifepath", "street kid"), "");
});
