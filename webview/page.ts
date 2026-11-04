// The Saves page's script, in the webview. It keeps the records the extension sends, runs the
// search (src/search.ts) on each change of the box, chips or sort, and draws the list, the chips,
// the selection and the details. The same script draws a loadout's tab (scope set): that loadout's
// saves, or with Add saves... every save elsewhere to pick from. It never moves a save itself: Move
// buttons send the selection to the extension, which asks and moves.
import type { SaveRecord } from "../src/metadata";
import {
  CHIP_KEYS,
  ChipKey,
  dayOf,
  difficultyLabel,
  kindLabel,
  lifePathLabel,
  NameOf,
  Playthrough,
  playthroughLabel,
  Places,
  readableId,
  Result,
  search,
  SortKey,
  titleOf,
  toggleChip,
} from "../src/search";

interface PageRecord extends SaveRecord {
  shot?: string;
}
interface Status {
  state: string;
  text: string;
}

declare function acquireVsCodeApi(): { postMessage(m: unknown): void; getState(): unknown; setState(s: unknown): void };
const vscode = acquireVsCodeApi();

const CHIP_NAMES: Record<ChipKey, string> = {
  where: "Where",
  lifepath: "Lifepath",
  gender: "V's body",
  voice: "V's voice",
  difficulty: "Difficulty",
  kind: "Kind",
  playthrough: "Playthrough",
  version: "Game version",
  pl: "Phantom Liberty",
  ponr: "Point of no return",
  modded: "Modded",
};

const saved = (vscode.getState() ?? {}) as { q?: string; sort?: SortKey; group?: boolean; help?: boolean };
let records: PageRecord[] = [];
let names: Record<string, string | null> = {};
let status: Status = { state: "working", text: "" };
let savesDir = "";
/** Set on a loadout's tab: its id. */
let scope: string | undefined;
let places: Places = {};
let loadout: { name: string; notes: string; count: number; bytes: number } | undefined;
/** On a loadout's tab: picking saves to add (every save elsewhere shows), rather than its own. */
let picking = false;
let scanInfo = { count: 0, read: 0, ms: 0 };
let query = saved.q ?? "";
let sort: SortKey = saved.sort ?? "newest";
let group = saved.group ?? false;
let help = saved.help ?? false;
let result: Result | undefined;
/** The order on screen, for Shift clicks. */
let shown: PageRecord[] = [];
const selected = new Set<string>();
let anchor: string | undefined;
let focused: string | undefined;

const nameOf: NameOf = (key) => (key ? names[key] ?? undefined : undefined);

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const hours = (s?: number) => (s === undefined ? "unknown" : `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`);
const num = (n?: number) => (n === undefined ? "?" : String(Math.round(n)));
const placeName = (where: string) => (where === "game" ? "the game" : places[where] ?? where);
const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const vOf = (r: SaveRecord) => (r.body ? `${r.body.toLowerCase()} V${r.voice && r.voice !== r.body ? `, ${r.voice.toLowerCase()} voice` : ""}` : "V");

function keep(): void {
  vscode.setState({ q: query, sort, group, help });
}

// ---- the page's frame, drawn once

const app = document.getElementById("app")!;
app.innerHTML = `
<header>
  <div id="loadout" class="loadout" hidden></div>
  <div class="bar">
    <div class="search"><span class="slash">/</span><input id="q" type="text" spellcheck="false" autocomplete="off" placeholder="Search saves: words, or filters such as lifepath:corpo level:&gt;40"><button id="clear" class="icon" title="Clear the search">&#x2715;</button></div>
    <select id="sort" title="Sort">
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="playtime">Most play time</option>
      <option value="level">Highest level</option>
      <option value="title">Title</option>
    </select>
    <label class="check"><input id="group" type="checkbox"> By playthrough</label>
    <button id="helpBtn" class="link">Search help</button>
  </div>
  <div id="help" class="help"></div>
  <div id="chips" class="chips"></div>
  <div class="tally"><span id="count"></span><span id="sel"></span>
    <button id="all" class="link">Select all</button><button id="none" class="link">Clear selection</button><button id="reveal" class="link">Show in folder</button><button id="move" class="act"></button>
  </div>
</header>
<main><section id="list" tabindex="0"></section><aside id="details"></aside></main>
<footer><span id="status"></span><span id="where"></span></footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const box = $<HTMLInputElement>("q");
const sortBox = $<HTMLSelectElement>("sort");
const groupBox = $<HTMLInputElement>("group");
box.value = query;
sortBox.value = sort;
groupBox.checked = group;

$("help").innerHTML = `
<p>Type words to find saves by their title, quest, place, lifepath or folder name. All words must match. Click a chip to add a filter, or type one. Click an example below to search with it:</p>
<table>
<tr><td><code class="try">lifepath:corpo</code> <code class="try">gender:male</code> <code class="try">voice:female</code></td><td>Lifepath (corpo, nomad, streetkid), V's body, V's voice</td></tr>
<tr><td><code class="try">kind:manual</code> <code class="try">playthrough:2</code> <code class="try">version:2.5</code></td><td>Kind (manual, auto, quick, ponr, endgame), playthrough, game version</td></tr>
<tr><td><code class="try">pl:yes</code> <code class="try">ponr:no</code> <code class="try">modded:yes</code> <code class="try">difficulty:veryhard</code></td><td>Phantom Liberty, point of no return, modded, difficulty</td></tr>
<tr><td><code class="try">level:&gt;40</code> <code class="try">cred:20-30</code> <code class="try">hours:&lt;100</code></td><td>Level, Street Cred, play time in hours</td></tr>
<tr><td><code class="try">body:&gt;=15</code> <code class="try">int:20</code> <code class="try">ref:&gt;10</code> <code class="try">tech:5-10</code> <code class="try">cool:&lt;8</code></td><td>Attributes: Body, Intelligence, Reflexes, Technical Ability, Cool</td></tr>
<tr><td><code class="try">date:2026-11</code> <code class="try">date:&gt;2026-10-01</code> <code class="try">date:&lt;2025</code></td><td>When it was saved</td></tr>
<tr><td><code class="try">quest:q112</code> <code class="try">fact:q112_takemura_dead=0</code></td><td>A finished quest (by id), a quest fact and its value. Click either in a save's details to add it</td></tr>
<tr><td><code class="try">-word</code> <code class="try">-kind:auto</code></td><td>A minus leaves out what matches</td></tr>
</table>
<p>Filters with the same key match any of their values (<code class="try">lifepath:corpo lifepath:nomad</code>); different keys must all match. Quotes keep spaces together.</p>`;

// An example in the help puts itself in the box and searches with it.
$("help").addEventListener("click", (e) => {
  const example = (e.target as HTMLElement).closest<HTMLElement>("code.try");
  if (example) setQuery(example.textContent ?? "");
});

function showHelp(): void {
  $("help").hidden = !help;
  $("helpBtn").textContent = help ? "Hide help" : "Search help";
}
showHelp();

// ---- drawing

function chipsHtml(r: Result): string {
  const rows: string[] = [];
  for (const key of CHIP_KEYS) {
    const facets = r.facets[key];
    if (facets.length < 2 && !facets.some((f) => f.active)) continue;
    const chips = facets
      .map((f) => `<button class="chip${f.active ? " on" : ""}${f.count ? "" : " none"}" data-key="${key}" data-value="${esc(f.value)}" title="${esc(`${key}:${f.value}`)}">${esc(f.label)} <b>${f.count}</b></button>`)
      .join("");
    rows.push(`<div class="row"><span class="key">${CHIP_NAMES[key]}</span><div class="set">${chips}</div></div>`);
  }
  return rows.join("");
}

function rowHtml(r: PageRecord): string {
  const quest = nameOf(r.mainQuest);
  const place = nameOf(r.location);
  const sub = [quest, place].filter(Boolean).join(" · ") || (r.questId ? readableId(r.questId) : "");
  const meta = [`<span class="life">${esc(lifePathLabel(r.lifePath))}</span>`, esc(vOf(r)), `LVL ${num(r.level)}`, `SC ${num(r.streetCred)}`];
  if (r.phantomLiberty) meta.push(`<span class="pl">PL</span>`);
  if (r.pointOfNoReturn) meta.push(`<span class="ponr">PONR</span>`);
  const cls = ["save", selected.has(r.dir) ? "on" : "", focused === r.dir ? "focus" : "", r.problem ? "bad" : ""].filter(Boolean).join(" ");
  // Where the save is, when the list shows more than one place.
  const at = manyPlaces ? `<span class="place">${esc(r.where === "game" ? "In the game" : placeName(r.where))}</span><br>` : "";
  return `<div class="${cls}" data-dir="${esc(r.dir)}">
  <div class="shot">${r.shot ? `<img loading="lazy" src="${esc(r.shot)}" alt="">` : ""}</div>
  <div class="text"><b>${esc(titleOf(r, nameOf))}</b><small>${esc(sub)}</small><small class="meta">${meta.join(" · ")}</small></div>
  <div class="when">${at}${esc(kindLabel(r.kind))}<br>${esc(when(r.time))}<br><span class="dim">${esc(hours(r.playTime))}</span></div>
</div>`;
}

function listHtml(r: Result): string {
  if (scope && !picking && !base().length) return `<p class="empty">No saves in this loadout yet. <button class="link" id="addSaves2">Add saves...</button></p>`;
  if (!base().length) return `<p class="empty">No saves in ${esc(savesDir)}.</p>`;
  if (!r.records.length) return `<p class="empty">No save matches. <button class="link" id="clear2">Clear the search</button></p>`;
  if (!group) {
    shown = r.records as PageRecord[];
    return shown.map(rowHtml).join("");
  }
  const by = new Map<string, PageRecord[]>();
  for (const rec of r.records as PageRecord[]) {
    const k = rec.playthroughId ?? "";
    by.set(k, [...(by.get(k) ?? []), rec]);
  }
  const ordered = [...by.entries()].sort((a, b) => (r.playthroughs.get(a[0])?.number ?? 1e9) - (r.playthroughs.get(b[0])?.number ?? 1e9));
  shown = ordered.flatMap(([, list]) => list);
  return ordered
    .map(([id, list]) => {
      const p = r.playthroughs.get(id);
      const head = p ? `Playthrough ${esc(playthroughLabel(p))}` : "No playthrough";
      const span = p ? ` · ${esc(dayOf(p.first))} to ${esc(dayOf(p.last))}` : "";
      return `<h2>${head} <span class="dim">${list.length} of ${p?.count ?? list.length} saves${span}</span></h2>${list.map(rowHtml).join("")}`;
    })
    .join("");
}

function detailsHtml(r: PageRecord | undefined, p: Map<string, Playthrough>): string {
  if (!r) return `<p class="empty">Click a save to see everything it says.<br><br>Ctrl and Shift clicks select several.</p>`;
  const a = r.attributes;
  const pt = r.playthroughId ? p.get(r.playthroughId) : undefined;
  const rows: [string, string][] = [
    ["Quest", nameOf(r.trackedQuest) ?? r.questId ?? "unknown"],
    ["Main quest", nameOf(r.mainQuest) ?? "unknown"],
    ["Place", nameOf(r.location) ?? "unknown"],
    ["Saved", `${when(r.time)}${r.timestamp ? "" : " (the file's time)"}`],
    ["Kind", `${kindLabel(r.kind)}, ${r.name}`],
    ["Where", r.where === "game" ? "In the game's save folder" : `In the loadout ${placeName(r.where)}`],
    ["Lifepath", lifePathLabel(r.lifePath)],
    ["V", `${r.body ?? "unknown"} body, ${r.voice ?? "unknown"} voice`],
    ["Level", `${num(r.level)}, Street Cred ${num(r.streetCred)}`],
    ["Attributes", a ? `Body ${num(a.body)}, Intelligence ${num(a.intelligence)}, Reflexes ${num(a.reflexes)}, Technical ${num(a.technical)}, Cool ${num(a.cool)}` : "unknown"],
    ["Difficulty", difficultyLabel(r.difficulty)],
    ["Play time", hours(r.playTime)],
    ["Playthrough", pt ? `${playthroughLabel(pt)} (${pt.count} saves)` : r.playthroughId ?? "unknown"],
    ["Game", `${r.patch ?? "unknown"}${r.phantomLiberty ? ", Phantom Liberty" : ""}${r.modded ? ", modded" : ""}`],
    ["Point of no return", r.pointOfNoReturn === undefined ? "unknown" : r.pointOfNoReturn ? "yes" : "no"],
    ["Size", r.fileSize === undefined ? "unknown" : `${(r.fileSize / 1048576).toFixed(1)} MB`],
  ];
  const quests = r.finishedQuests.map((q) => `<button class="tag" data-add="quest:${esc(q)}" title="Saves that finished ${esc(q)}">${esc(q)}</button>`).join("");
  const facts = r.facts.map((f) => `<button class="tag" data-add="fact:${esc(f)}" title="Saves with ${esc(f)}">${esc(f)}</button>`).join("");
  return `${r.shot ? `<img class="big" src="${esc(r.shot)}" alt="">` : ""}
<h3>${esc(titleOf(r, nameOf))}</h3>
${r.problem ? `<p class="warn">${esc(r.problem)}</p>` : ""}
<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
<p class="actions"><button class="link" data-reveal="${esc(r.dir)}">Show in folder</button><button class="link" data-copy="${esc(r.dir)}">Copy the folder's path</button></p>
<details><summary>Finished quests (${r.finishedQuests.length})</summary><div class="tags">${quests || "none"}</div></details>
<details><summary>Quest facts (${r.facts.length})</summary><div class="tags">${facts || "none"}</div></details>`;
}

/** The saves this tab works on: all of them; a loadout's own; or, when adding, every save elsewhere. */
function base(): PageRecord[] {
  if (!scope) return records;
  return records.filter((r) => (picking ? r.where !== scope : r.where === scope));
}
let manyPlaces = false;

function loadoutHtml(): string {
  if (!scope || !loadout) return "";
  const notes = loadout.notes ? `<p class="notes">${esc(loadout.notes)}</p>` : "";
  if (picking) {
    return `<div class="lbar"><h1>Add saves to ${esc(loadout.name)}</h1><button id="doneAdding" class="link">Back to ${esc(loadout.name)}</button></div>
<p class="dim">Every save in the game and in the other loadouts. Search or filter, select, then <b>Add to ${esc(loadout.name)}</b>: they move into this loadout.</p>`;
  }
  return `<div class="lbar"><h1>${esc(loadout.name)}</h1><span class="dim">${loadout.count} saves · ${gb(loadout.bytes)}</span><button id="addSaves" class="act">Add saves...</button></div>${notes}`;
}

function tally(): void {
  const total = base().length;
  const n = result?.records.length ?? 0;
  $("count").textContent = n === total ? `${total} saves` : `${n} of ${total} saves`;
  $("sel").textContent = selected.size ? ` · ${selected.size} selected` : "";
  $("none").hidden = !selected.size;
  $("reveal").hidden = !selected.size;
  $("all").hidden = !n;
  const mv = $("move");
  mv.hidden = !selected.size;
  mv.textContent = !scope ? "Move to loadout..." : picking ? `Add ${selected.size} to ${loadout?.name ?? "this loadout"}` : "Move to...";
}

function draw(): void {
  const list = base();
  result = search(list, query, nameOf, sort, places);
  manyPlaces = new Set(list.map((r) => r.where)).size > 1;
  $("loadout").hidden = !scope;
  $("loadout").innerHTML = loadoutHtml();
  // A selection keeps only saves that are still on this tab; it is kept across searches.
  const live = new Set(list.map((r) => r.dir));
  for (const d of [...selected]) if (!live.has(d)) selected.delete(d);
  $("chips").innerHTML = chipsHtml(result);
  $("list").innerHTML = listHtml(result);
  drawDetails();
  tally();
  $("status").textContent = status.text;
  $("status").className = status.state;
  $("where").textContent = savesDir ? `${savesDir} · ${scanInfo.count} saves, read in ${scanInfo.ms} ms` : "";
}

function drawDetails(): void {
  const r = records.find((x) => x.dir === focused);
  $("details").innerHTML = detailsHtml(r, result?.playthroughs ?? new Map());
}

/** Only the rows' look, after a click: no new search. */
function drawSelection(): void {
  for (const el of document.querySelectorAll<HTMLElement>("#list .save")) {
    el.classList.toggle("on", selected.has(el.dataset.dir!));
    el.classList.toggle("focus", el.dataset.dir === focused);
  }
  drawDetails();
  tally();
}

// ---- events

let typing: ReturnType<typeof setTimeout> | undefined;
box.addEventListener("input", () => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    query = box.value;
    keep();
    draw();
  }, 120);
});
box.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setQuery("");
});
$("clear").addEventListener("click", () => setQuery(""));
sortBox.addEventListener("change", () => {
  sort = sortBox.value as SortKey;
  keep();
  draw();
});
groupBox.addEventListener("change", () => {
  group = groupBox.checked;
  keep();
  draw();
});
$("helpBtn").addEventListener("click", () => {
  help = !help;
  keep();
  showHelp();
});

function setQuery(text: string): void {
  query = text;
  box.value = text;
  keep();
  draw();
}

$("chips").addEventListener("click", (e) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>(".chip");
  if (chip) setQuery(toggleChip(query, chip.dataset.key!, chip.dataset.value!));
});

$("list").addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.id === "clear2") return setQuery("");
  if (t.id === "addSaves2") return setPicking(true);
  const row = t.closest<HTMLElement>(".save");
  if (!row) return;
  const dir = row.dataset.dir!;
  if (e.shiftKey && anchor) {
    const a = shown.findIndex((r) => r.dir === anchor);
    const b = shown.findIndex((r) => r.dir === dir);
    if (!e.ctrlKey) selected.clear();
    for (const r of shown.slice(Math.min(a, b), Math.max(a, b) + 1)) selected.add(r.dir);
  } else if (e.ctrlKey || e.metaKey) {
    if (selected.has(dir)) selected.delete(dir);
    else selected.add(dir);
    anchor = dir;
  } else {
    selected.clear();
    selected.add(dir);
    anchor = dir;
  }
  focused = dir;
  drawSelection();
});

$("all").addEventListener("click", () => {
  for (const r of result?.records ?? []) selected.add(r.dir);
  drawSelection();
});
$("none").addEventListener("click", () => {
  selected.clear();
  drawSelection();
});
$("reveal").addEventListener("click", () => vscode.postMessage({ type: "reveal", dirs: [...selected] }));
// The extension asks where to (unless adding to this loadout), confirms with the counts, and moves.
$("move").addEventListener("click", () => vscode.postMessage({ type: "move", dirs: [...selected], target: scope && picking ? scope : undefined, query }));

function setPicking(on: boolean): void {
  picking = on;
  selected.clear();
  focused = undefined;
  setQuery("");
}
$("loadout").addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).id;
  if (id === "addSaves") setPicking(true);
  if (id === "doneAdding") setPicking(false);
});

$("details").addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!t) return;
  if (t.dataset.add) setQuery(query.includes(t.dataset.add) ? query : `${query.trim()} ${t.dataset.add}`.trim());
  if (t.dataset.reveal) vscode.postMessage({ type: "reveal", dirs: [t.dataset.reveal] });
  if (t.dataset.copy) vscode.postMessage({ type: "copy", text: t.dataset.copy });
});

document.addEventListener("keydown", (e) => {
  if (e.target === box) return;
  if (e.key === "/" || (e.key === "f" && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    box.focus();
    box.select();
  } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $("all").click();
  } else if (e.key === "Escape") {
    $("none").click();
  }
});

window.addEventListener("message", (e) => {
  const m = e.data;
  if (m.type === "data") {
    records = m.records;
    names = m.names;
    status = m.status;
    savesDir = m.savesDir;
    scanInfo = m.scan;
    scope = m.scope;
    places = m.places ?? {};
    loadout = m.loadout;
    // after a move, the moved saves are no longer on this tab: the selection drops them in draw()
    if (m.moved && picking) picking = false;
    draw();
  } else if (m.type === "names") {
    names = m.names;
    status = m.status;
    draw();
  } else if (m.type === "query") {
    setQuery(m.text);
  }
});

vscode.postMessage({ type: "ready" });
