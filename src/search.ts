// Search, filters, sort and groups over save records. Pure code with no Node or VS Code imports:
// the Saves page runs it in the webview and the tests in Node.
//
// The search box holds everything: plain words, and filters as key:value words that the chips
// write too. Words must all match; filters with the same key match any of their values; filters
// with different keys must all match; a leading "-" excludes.
//
//   corpo takemura              words, across the title, quest, main quest, place, lifepath, folder
//   lifepath:corpo gender:male  chips (lifepath, gender, voice, difficulty, kind, playthrough,
//                               version, pl, ponr, modded)
//   level:>40 cred:20-30        ranges (level, cred, hours, body, int, ref, tech, cool)
//   date:2026-11 date:>2026-10-01
//   quest:q112 fact:q112_takemura_dead=0 -fact:sq031_grayson_killed
import type { SaveRecord } from "./metadata";

/** Names for LocKeys: "LocKey#98600" to "Clampdown", or undefined when none is known. */
export type NameOf = (key: string | undefined) => string | undefined;

export const CHIP_KEYS = ["lifepath", "gender", "voice", "difficulty", "kind", "playthrough", "version", "pl", "ponr", "modded"] as const;
export type ChipKey = (typeof CHIP_KEYS)[number];
const RANGE_KEYS = ["level", "cred", "hours", "body", "int", "ref", "tech", "cool"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];
const OTHER_KEYS = ["date", "quest", "fact"] as const;

export interface Term {
  key?: string;
  value: string;
  not: boolean;
}

const LIFEPATHS: Record<string, string> = { Corporate: "Corpo", StreetKid: "Street Kid", Nomad: "Nomad" };
const KINDS: Record<string, string> = { manual: "Manual", auto: "Autosave", quick: "Quick save", pointOfNoReturn: "Point of no return", endGame: "End of the game" };

/** Lower case, no accents, for matching. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const spaced = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");
export const lifePathLabel = (v?: string) => (v ? LIFEPATHS[v] ?? spaced(v) : "Unknown");
export const kindLabel = (v: string) => KINDS[v] ?? v;
export const difficultyLabel = (v?: string) => (v ? spaced(v) : "Unknown");

/** A quest id made readable: "mq062_clampdown" to "mq062 clampdown". */
export const readableId = (id: string) => id.replace(/_/g, " ");

/** What a save is called: its quest's name, else its quest id made readable, else its kind. */
export function titleOf(r: SaveRecord, nameOf: NameOf): string {
  return nameOf(r.trackedQuest) ?? (r.questId ? readableId(r.questId) : kindLabel(r.kind));
}

/** Splits the box into words and key:value terms; quotes keep spaces in one ("lifepath:street kid" as lifepath:"street kid"). */
export function parseQuery(text: string): Term[] {
  const terms: Term[] = [];
  for (const m of text.matchAll(/(-?)(?:([a-z]+):)?(?:"([^"]*)"|(\S+))/gi)) {
    const not = m[1] === "-";
    const key = m[2]?.toLowerCase();
    const value = (m[3] ?? m[4] ?? "").trim();
    if (!value && !key) continue;
    if (key && !(CHIP_KEYS as readonly string[]).includes(key) && !(RANGE_KEYS as readonly string[]).includes(key) && !(OTHER_KEYS as readonly string[]).includes(key)) {
      // not a key REDsave knows: the whole thing is a word ("12:30" or "vs:x")
      terms.push({ value: `${key}:${value}`, not });
      continue;
    }
    terms.push({ key, value, not });
  }
  return terms;
}

/** A chip's value for a record, as written in the box: lifepath:corpo, kind:manual, pl:yes. */
export function chipValue(r: SaveRecord, key: ChipKey, playthroughs: Map<string, Playthrough>): string | undefined {
  const yesNo = (b?: boolean) => (b === undefined ? undefined : b ? "yes" : "no");
  switch (key) {
    case "lifepath":
      return r.lifePath && fold(lifePathLabel(r.lifePath)).replace(/\s+/g, "");
    case "gender":
      return r.body && fold(r.body);
    case "voice":
      return r.voice && fold(r.voice);
    case "difficulty":
      return r.difficulty && fold(r.difficulty);
    case "kind":
      return { manual: "manual", auto: "auto", quick: "quick", pointOfNoReturn: "ponr", endGame: "endgame" }[r.kind];
    case "playthrough":
      return r.playthroughId && String(playthroughs.get(r.playthroughId)?.number ?? "");
    case "version":
      return r.patch;
    case "pl":
      return yesNo(r.phantomLiberty);
    case "ponr":
      return yesNo(r.pointOfNoReturn);
    case "modded":
      return yesNo(r.modded);
  }
}

/** What a chip value is shown as. */
export function chipLabel(key: ChipKey, value: string, playthroughs: Map<string, Playthrough>): string {
  switch (key) {
    case "lifepath":
      return { corpo: "Corpo", streetkid: "Street Kid", nomad: "Nomad" }[value] ?? value;
    case "gender":
    case "voice":
      return value[0].toUpperCase() + value.slice(1);
    case "difficulty":
      return { story: "Story", easy: "Easy", normal: "Normal", hard: "Hard", veryhard: "Very Hard" }[value] ?? value;
    case "kind":
      return { manual: "Manual", auto: "Autosave", quick: "Quick save", ponr: "Point of no return", endgame: "End of the game" }[value] ?? value;
    case "playthrough": {
      const p = [...playthroughs.values()].find((x) => String(x.number) === value);
      return p ? playthroughLabel(p) : `Playthrough ${value}`;
    }
    case "version":
      return `Game ${value}`;
    default:
      return value === "yes" ? "Yes" : "No";
  }
}

function rangeValue(r: SaveRecord, key: RangeKey): number | undefined {
  const a = r.attributes;
  return {
    level: r.level,
    cred: r.streetCred,
    hours: r.playTime === undefined ? undefined : r.playTime / 3600,
    body: a?.body,
    int: a?.intelligence,
    ref: a?.reflexes,
    tech: a?.technical,
    cool: a?.cool,
  }[key];
}

/** ">40", "<20", "30-50", "42" against a number. A value of another shape matches nothing. */
export function inRange(n: number | undefined, spec: string): boolean {
  if (n === undefined) return false;
  let m = /^(>=|<=|>|<)\s*(\d+(?:\.\d+)?)$/.exec(spec);
  if (m) {
    const v = Number(m[2]);
    return m[1] === ">" ? n > v : m[1] === "<" ? n < v : m[1] === ">=" ? n >= v : n <= v;
  }
  m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(spec);
  if (m) return n >= Number(m[1]) && n <= Number(m[2]);
  return /^\d+(\.\d+)?$/.test(spec) ? Math.floor(n) === Number(spec) : false;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** A time as the date words use it: 2026-11-03. Local time. */
export function dayOf(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026", "2026-11", "2026-11-03", with ">" or "<" before it. */
export function onDate(time: number, spec: string): boolean {
  const day = dayOf(time);
  const m = /^(>|<)?(\d{4}(?:-\d{2}(?:-\d{2})?)?)$/.exec(spec);
  if (!m) return false;
  if (!m[1]) return day.startsWith(m[2]);
  // compare with the period's first day (>) or last (<), by prefix: "2026-10" covers the whole month
  return m[1] === ">" ? day > m[2] && !day.startsWith(m[2]) : day < m[2];
}

function factMatches(r: SaveRecord, spec: string): boolean {
  const [name, value] = spec.split("=");
  const n = fold(name);
  return r.facts.some((f) => {
    const [fn, fv] = f.split("=");
    return fold(fn) === n && (value === undefined || fv === value);
  });
}

/** The words a save is found by. */
export function haystack(r: SaveRecord, nameOf: NameOf): string {
  return fold(
    [titleOf(r, nameOf), r.questId, nameOf(r.mainQuest), nameOf(r.location), lifePathLabel(r.lifePath), r.name, kindLabel(r.kind)]
      .filter(Boolean)
      .join(" \u0001 "),
  );
}

function termMatches(r: SaveRecord, t: Term, ctx: Context): boolean {
  if (!t.key) return ctx.hay(r).includes(fold(t.value));
  if ((CHIP_KEYS as readonly string[]).includes(t.key)) return chipValue(r, t.key as ChipKey, ctx.playthroughs) === fold(t.value).replace(/\s+/g, "");
  if ((RANGE_KEYS as readonly string[]).includes(t.key)) return inRange(rangeValue(r, t.key as RangeKey), t.value);
  if (t.key === "date") return onDate(r.time, t.value);
  if (t.key === "quest") return r.finishedQuests.some((q) => fold(q).startsWith(fold(t.value)));
  if (t.key === "fact") return factMatches(r, t.value);
  return false;
}

interface Context {
  hay: (r: SaveRecord) => string;
  playthroughs: Map<string, Playthrough>;
}

/** Whether a record matches every term; terms of one key match when any of them does. */
function matchesAll(r: SaveRecord, terms: Term[], ctx: Context, skipKey?: string): boolean {
  const byKey = new Map<string, Term[]>();
  for (const t of terms) {
    if (t.key && t.key === skipKey) continue;
    if (t.not) {
      if (termMatches(r, t, ctx)) return false;
      continue;
    }
    // words each count on their own; filters group by key
    const k = t.key ?? `\u0000${byKey.size}`;
    byKey.set(k, [...(byKey.get(k) ?? []), t]);
  }
  for (const group of byKey.values()) if (!group.some((t) => termMatches(r, t, ctx))) return false;
  return true;
}

export interface Playthrough {
  id: string;
  /** 1 for the playthrough with the earliest save. */
  number: number;
  lifePath?: string;
  body?: string;
  count: number;
  first: number;
  last: number;
}

/** The playthroughs among the records, numbered by their first save. */
export function playthroughsOf(records: SaveRecord[]): Map<string, Playthrough> {
  const map = new Map<string, Playthrough>();
  for (const r of records) {
    if (!r.playthroughId) continue;
    const p = map.get(r.playthroughId) ?? { id: r.playthroughId, number: 0, count: 0, first: r.time, last: r.time, lifePath: r.lifePath, body: r.body };
    p.count++;
    if (r.time < p.first) {
      p.first = r.time;
      p.lifePath = r.lifePath;
      p.body = r.body;
    }
    p.last = Math.max(p.last, r.time);
    map.set(r.playthroughId, p);
  }
  [...map.values()].sort((a, b) => a.first - b.first).forEach((p, i) => (p.number = i + 1));
  return map;
}

export function playthroughLabel(p: Playthrough): string {
  return `${p.number}: ${lifePathLabel(p.lifePath)}, ${p.body ? `${p.body.toLowerCase()} V` : "V"}`;
}

export type SortKey = "newest" | "oldest" | "playtime" | "level" | "title";

export interface Facet {
  value: string;
  label: string;
  /** Saves with this value among those the other filters leave. */
  count: number;
  active: boolean;
}

export interface Result {
  records: SaveRecord[];
  facets: Record<ChipKey, Facet[]>;
  playthroughs: Map<string, Playthrough>;
}

/** Runs the box's text over the records: the matching ones, sorted, and the chips with their counts. */
export function search(records: SaveRecord[], text: string, nameOf: NameOf, sort: SortKey = "newest"): Result {
  const terms = parseQuery(text);
  const playthroughs = playthroughsOf(records);
  const hays = new Map<SaveRecord, string>();
  const ctx: Context = {
    playthroughs,
    hay: (r) => {
      let h = hays.get(r);
      if (h === undefined) hays.set(r, (h = haystack(r, nameOf)));
      return h;
    },
  };
  const found = records.filter((r) => matchesAll(r, terms, ctx));
  const facets = {} as Record<ChipKey, Facet[]>;
  for (const key of CHIP_KEYS) {
    const active = new Set(terms.filter((t) => t.key === key && !t.not).map((t) => fold(t.value).replace(/\s+/g, "")));
    const counts = new Map<string, number>();
    for (const r of records) {
      const v = chipValue(r, key, playthroughs);
      if (v === undefined || v === "") continue;
      if (!counts.has(v)) counts.set(v, 0);
      if (matchesAll(r, terms, ctx, key)) counts.set(v, counts.get(v)! + 1);
    }
    facets[key] = [...counts]
      .map(([value, count]) => ({ value, label: chipLabel(key, value, playthroughs), count, active: active.has(value) }))
      .sort((a, b) => (key === "playthrough" ? Number(a.value) - Number(b.value) : key === "version" ? parseFloat(b.value) - parseFloat(a.value) : b.count - a.count));
  }
  return { records: sortRecords(found, sort, nameOf), facets, playthroughs };
}

export function sortRecords(records: SaveRecord[], sort: SortKey, nameOf: NameOf): SaveRecord[] {
  const by: Record<SortKey, (a: SaveRecord, b: SaveRecord) => number> = {
    newest: (a, b) => b.time - a.time,
    oldest: (a, b) => a.time - b.time,
    playtime: (a, b) => (b.playTime ?? -1) - (a.playTime ?? -1) || b.time - a.time,
    level: (a, b) => (b.level ?? -1) - (a.level ?? -1) || b.time - a.time,
    title: (a, b) => titleOf(a, nameOf).localeCompare(titleOf(b, nameOf)) || b.time - a.time,
  };
  return [...records].sort(by[sort]);
}

/** The box's text with a chip turned on or off: adds or removes key:value, keeping the rest. */
export function toggleChip(text: string, key: string, value: string): string {
  const word = /\s/.test(value) ? `${key}:"${value}"` : `${key}:${value}`;
  const re = new RegExp(`(^|\\s)${key}:(?:"${escape(value)}"|${escape(value)})(?=\\s|$)`, "i");
  if (re.test(text)) return text.replace(re, "").replace(/\s{2,}/g, " ").trim();
  return `${text.trim()} ${word}`.trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
