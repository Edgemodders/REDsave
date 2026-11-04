// REDsave's extension. S1, Find: the index of every save, the Saves page and the side bar's counts.
// S2a, Library and Move: loadouts as children of the side bar's Loadouts node, a tab per loadout
// with Add saves..., and moving a selection of saves between the game's folder and the loadouts
// (move.ts: the checks, the journal, undo). Swapping a whole loadout in is S2b (docs/design.md).
import * as vscode from "vscode";
import * as path from "node:path";
import { defaultSavesPath, KIND_NAMES, SaveKind } from "./saves";
import { SaveIndex } from "./index";
import { Names } from "./names";
import { findGame } from "./game";
import { SavesPage } from "./page";
import { playthroughLabel, playthroughsOf } from "./search";
import { defaultLibraryPath, Library, within } from "./library";
import { Place, planMove, recover, runMove, undoPlan } from "./move";
import type { SaveRecord } from "./metadata";

const KIND_WORDS: Record<SaveKind, string> = { manual: "manual", auto: "auto", quick: "quick", pointOfNoReturn: "ponr", endGame: "endgame" };

let log: vscode.OutputChannel;
let index: SaveIndex;
let names: Names;
let library: Library;
let records: SaveRecord[] = [];
let scanInfo = { count: 0, read: 0, ms: 0 };
let busy = false;

const config = () => vscode.workspace.getConfiguration("redsave");
const savesPath = () => config().get<string>("savesPath")?.trim() || defaultSavesPath();
const libraryPath = () => config().get<string>("libraryPath")?.trim() || defaultLibraryPath();

/** The game folder for REDbridge: the setting, EDGEdeck's when it runs, else Steam, GOG or Epic. */
function gameDir(): string | undefined {
  const deck = vscode.extensions.getExtension("edgemodders.edgedeck");
  const fromDeck = deck?.isActive ? (deck.exports as { gamePath?: () => string | undefined })?.gamePath?.() : undefined;
  return findGame(config().get<string>("gamePath")?.trim() || fromDeck);
}

/** The library and the game's save folder must not be inside each other: a move would move into itself. */
function placesProblem(): string | undefined {
  if (within(libraryPath(), savesPath()) || within(savesPath(), libraryPath())) {
    return `REDsave's library (${libraryPath()}) and the game's save folder (${savesPath()}) must be separate folders, neither inside the other. Change redsave.libraryPath.`;
  }
  return undefined;
}

const placeName = (where: string) => (where === "game" ? "the game" : library.loadout(where)?.name ?? where);
const placeOf = (where: string): Place => ({ where, dir: where === "game" ? savesPath() : library.dirOf(where), name: placeName(where) });
const countIn = (where: string) => records.filter((r) => r.where === where).length;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

class LoadoutItem extends vscode.TreeItem {
  constructor(readonly loadoutId: string, label: string) {
    super(label);
  }
}

class SavesView implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(parent?: vscode.TreeItem): vscode.TreeItem[] {
    const open = (query: string) => ({ command: "redsave.openPage", title: "Open", arguments: [query] });
    const game = records.filter((r) => r.where === "game");
    if (parent?.id === "playthroughs") {
      return [...playthroughsOf(game).values()]
        .sort((a, b) => a.number - b.number)
        .map((p) => {
          const item = new vscode.TreeItem(playthroughLabel(p));
          item.description = String(p.count);
          item.iconPath = new vscode.ThemeIcon("person");
          item.command = open(`where:game playthrough:${p.number}`);
          return item;
        });
    }
    if (parent?.id === "loadouts") {
      return library.loadouts.map((l) => {
        const item = new LoadoutItem(l.id, l.name);
        const n = countIn(l.id);
        item.id = `loadout:${l.id}`;
        item.description = library.inGame === l.id ? `${n} · in the game` : String(n);
        item.tooltip = new vscode.MarkdownString(`**${l.name}**: ${plural(n, "save")}${l.notes ? `\n\n${l.notes}` : ""}`);
        item.iconPath = new vscode.ThemeIcon(library.inGame === l.id ? "circle-filled" : "save-all");
        item.contextValue = "redsave.loadout";
        item.command = { command: "redsave.openLoadout", title: "Open", arguments: [l.id] };
        return item;
      });
    }
    if (parent?.id === "game") {
      const counts = new Map<SaveKind, number>();
      for (const r of game) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
      const kinds = [...counts].map(([kind, n]) => {
        const item = new vscode.TreeItem(KIND_NAMES[kind]);
        item.description = String(n);
        item.iconPath = new vscode.ThemeIcon("save");
        item.command = open(`where:game kind:${KIND_WORDS[kind]}`);
        return item;
      });
      const pts = new vscode.TreeItem("Playthroughs", vscode.TreeItemCollapsibleState.Collapsed);
      pts.id = "playthroughs";
      pts.iconPath = new vscode.ThemeIcon("history");
      return [...kinds, pts];
    }
    if (parent) return [];
    // No game saves and no loadouts: the view shows its welcome text.
    if (!records.length && !library.loadouts.length) return [];
    const page = new vscode.TreeItem("Open the Saves page");
    page.iconPath = new vscode.ThemeIcon("search");
    page.description = plural(records.length, "save");
    page.command = open("");
    const inGame = new vscode.TreeItem("In the game", vscode.TreeItemCollapsibleState.Expanded);
    inGame.id = "game";
    inGame.iconPath = new vscode.ThemeIcon("game");
    inGame.description = `${game.length} · ${library.inGame ? library.loadout(library.inGame)?.name : "not in a loadout yet"}`;
    inGame.tooltip = `The saves in the game's save folder: ${savesPath()}`;
    inGame.command = open("where:game");
    const loadouts = new vscode.TreeItem("Loadouts", vscode.TreeItemCollapsibleState.Expanded);
    loadouts.id = "loadouts";
    loadouts.iconPath = new vscode.ThemeIcon("folder-library");
    loadouts.description = library.loadouts.length ? String(library.loadouts.length) : "none yet: + makes one";
    loadouts.contextValue = library.journal && undoPlan(library) ? "redsave.loadouts.undo" : "redsave.loadouts";
    return [page, inGame, loadouts];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  log = vscode.window.createOutputChannel("REDsave");
  const store = context.globalStorageUri.fsPath;
  index = new SaveIndex(path.join(store, "index.json"));
  names = new Names(store, "en-us", (line) => log.appendLine(line));
  library = new Library(libraryPath());
  const view = new SavesView();
  const openFolder = () => void vscode.env.openExternal(vscode.Uri.file(savesPath()));

  const pageData = () => ({
    records,
    names: names.known,
    status: names.status,
    savesDir: savesPath(),
    libraryDir: library.root,
    scan: scanInfo,
    places: Object.fromEntries(library.loadouts.map((l) => [l.id, l.name])),
    loadout: (id: string) => {
      const l = library.loadout(id);
      if (!l) return undefined;
      const mine = records.filter((r) => r.where === id);
      return { name: l.name, notes: l.notes, count: mine.length, bytes: mine.reduce((n, r) => n + (r.fileSize ?? 0), 0) };
    },
  });
  const actions = { openFolder, move: (dirs: string[], target: string | undefined, query: string) => void moveSaves(dirs, target, query) };
  const mainPage = new SavesPage(context.extensionUri, undefined, pageData, actions);
  const tabs = new Map<string, SavesPage>();
  const allPages = () => [mainPage, ...tabs.values()];
  const openLoadout = (id: string) => {
    if (!library.loadout(id)) return;
    let tab = tabs.get(id);
    if (!tab) {
      tab = new SavesPage(context.extensionUri, id, pageData, actions, () => tabs.delete(id));
      tabs.set(id, tab);
    }
    tab.show();
  };

  const scan = (moved = false) => {
    const dir = savesPath();
    const r = index.scan(dir, "game");
    let all = r.records;
    let read = r.read;
    let ms = r.ms;
    for (const l of library.loadouts) {
      const s = index.scan(library.dirOf(l.id), l.id);
      all = all.concat(s.records);
      read += s.read;
      ms += s.ms;
    }
    records = all;
    scanInfo = { count: all.length, read, ms };
    log.appendLine(`${all.length} saves (${r.records.length} in the game, ${all.length - r.records.length} in ${plural(library.loadouts.length, "loadout")}), ${read} read from their files, in ${ms} ms`);
    view.refresh();
    for (const p of allPages()) p.refresh(moved);
    const keys = records.flatMap((x) => [x.trackedQuest, x.mainQuest, x.location]).filter((k): k is string => !!k);
    void names.resolve(keys, gameDir()).then(() => {
      if (names.status.state !== "ready") log.appendLine(names.status.text);
      for (const p of allPages()) p.names(names.known, names.status);
    });
  };
  const watch = () => index.watch(savesPath(), () => scan());

  /** Asks where to (unless given), confirms with the counts, and moves. */
  async function moveSaves(dirs: string[], target: string | undefined, query: string): Promise<void> {
    if (busy) return void vscode.window.showWarningMessage("REDsave is moving saves already. Wait for it to finish.");
    const problem = placesProblem();
    if (problem) return void vscode.window.showErrorMessage(problem);
    const chosen = records.filter((r) => dirs.includes(r.dir));
    if (!chosen.length) return;
    if (!target) {
      const sources = new Set(chosen.map((r) => r.where));
      const picks: (vscode.QuickPickItem & { where?: string; make?: boolean })[] = [
        { label: "$(add) New loadout...", description: "made from these saves", make: true },
        { label: "$(game) In the game", description: `${countIn("game")} saves · the game's save folder`, where: "game" },
        ...library.loadouts.map((l) => ({ label: `$(save-all) ${l.name}`, description: plural(countIn(l.id), "save"), where: l.id })),
      ].filter((p) => p.make || !(sources.size === 1 && sources.has(p.where!)));
      const pick = await vscode.window.showQuickPick(picks, { title: `Move ${plural(chosen.length, "save")} to...`, placeHolder: "A loadout, or the game's save folder" });
      if (!pick) return;
      if (pick.make) {
        const made = await newLoadout(query.replace(/\b\w+:("[^"]*"|\S+)/g, "").trim() || undefined);
        if (!made) return;
        target = made;
      } else target = pick.where;
    }
    const place = placeOf(target!);
    const plan = planMove(chosen.map((r) => ({ dir: r.dir, where: r.where })), place);
    if (!plan.items.length) return void vscode.window.showInformationMessage(`${plural(chosen.length, "save is", "saves are")} in ${place.name} already.`);
    const from = new Map<string, number>();
    for (const i of plan.items) from.set(i.source, (from.get(i.source) ?? 0) + 1);
    const fromText = [...from].map(([w, n]) => `${n} from ${w === "game" ? "the game's folder" : placeName(w)}`).join(", ");
    const renamed = plan.items.filter((i) => i.renamed).length;
    const detail = [
      `${fromText}.`,
      plan.already ? `${plan.already} ${plan.already === 1 ? "is" : "are"} in ${place.name} already and stay${plan.already === 1 ? "s" : ""}.` : "",
      renamed ? `${plural(renamed, "save gets", "saves get")} a new folder number, since ${renamed === 1 ? "its name is" : "their names are"} taken there.` : "",
      "Nothing is deleted, and Undo the last move puts them back.",
    ].filter(Boolean).join("\n");
    const ok = await vscode.window.showWarningMessage(`Move ${plural(plan.items.length, "save")} to ${place.name}?`, { modal: true, detail }, "Move");
    if (ok !== "Move") return;
    const touchesGame = target === "game" || plan.items.some((i) => i.source === "game");
    await runAndReport(plan, `Move ${plural(plan.items.length, "save")} to ${place.name}`, touchesGame);
  }

  async function runAndReport(plan: ReturnType<typeof planMove>, label: string, touchesGame: boolean, undoOf?: string): Promise<void> {
    // Busy only while saves move: the notices after it can stay open as long as the player likes.
    busy = true;
    let result: Awaited<ReturnType<typeof runMove>>;
    try {
      result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: label, cancellable: false }, (p) =>
        runMove(plan, library, { label, touchesGame, undoOf, progress: (done, total) => p.report({ message: `${done} of ${total}`, increment: 100 / total }) }),
      );
    } catch (err) {
      busy = false;
      return void vscode.window.showErrorMessage((err as Error).message);
    }
    busy = false;
    log.appendLine(`${label}: ${result.moved} moved${result.error ? `; stopped: ${result.error}` : ""}`);
    scan(true);
    const journal = result.journal.id;
    if (result.error) {
      const b = await vscode.window.showErrorMessage(`REDsave stopped: ${result.error}`, "Undo the last move");
      if (b) await undo(journal);
      return;
    }
    const b = await vscode.window.showInformationMessage(`${undoOf ? "Put back" : "Moved"} ${plural(result.moved, "save")}${undoOf ? "" : ` to ${plan.target.name}`}.`, ...(undoOf ? [] : ["Undo", "Open"]));
    if (b === "Undo") await undo(journal);
    if (b === "Open") plan.target.where === "game" ? mainPage.show("where:game") : openLoadout(plan.target.where);
  }

  /** Undoes the last move; from a notice's Undo (only: that notice's move), only while it is still the last one. */
  async function undo(only?: string): Promise<void> {
    if (busy) return void vscode.window.showWarningMessage("REDsave is moving saves already. Wait for it to finish.");
    const u = undoPlan(library);
    if (only && u?.of !== only) return void vscode.window.showInformationMessage("That move cannot be undone from here any more: another move came after it. Undo the Last Move undoes the newest one.");
    if (!u) return void vscode.window.showInformationMessage("There is no move to undo.");
    const ok = await vscode.window.showWarningMessage(`${u.label}?`, { modal: true, detail: `${plural(u.items.length, "save goes", "saves go")} back where ${u.items.length === 1 ? "it was" : "they were"}.` }, "Undo");
    if (ok !== "Undo") return;
    const saves = savesPath();
    const touchesGame = u.items.some((i) => within(i.from, saves) || within(i.to, saves));
    await runAndReport({ target: { where: "", dir: "", name: "where they were" }, items: u.items, already: 0 }, u.label, touchesGame, u.of);
  }

  async function newLoadout(suggested?: string): Promise<string | undefined> {
    const problem = placesProblem();
    if (problem) return void vscode.window.showErrorMessage(problem);
    const name = await vscode.window.showInputBox({
      title: "New loadout",
      prompt: "A name for the loadout, such as Dogtown run or Mod test",
      value: suggested,
      validateInput: (v) => (!v.trim() ? "A loadout needs a name" : library.loadouts.some((l) => l.name.toLowerCase() === v.trim().toLowerCase()) ? "There is a loadout with that name already" : undefined),
    });
    if (!name) return undefined;
    const l = library.create(name);
    log.appendLine(`New loadout ${l.name} in ${library.dirOf(l.id)}`);
    scan();
    return l.id;
  }

  const idOf = (arg: unknown) => (arg instanceof LoadoutItem ? arg.loadoutId : typeof arg === "string" ? arg : undefined);

  context.subscriptions.push(
    log,
    vscode.window.registerTreeDataProvider("redsave.saves", view),
    vscode.commands.registerCommand("redsave.openPage", (query?: string) => mainPage.show(typeof query === "string" ? query : undefined)),
    vscode.commands.registerCommand("redsave.refresh", () => scan()),
    vscode.commands.registerCommand("redsave.openSavesFolder", openFolder),
    vscode.commands.registerCommand("redsave.newLoadout", async () => {
      const id = await newLoadout();
      if (id) openLoadout(id);
    }),
    vscode.commands.registerCommand("redsave.openLoadout", (arg: unknown) => {
      const id = idOf(arg);
      if (id) openLoadout(id);
    }),
    vscode.commands.registerCommand("redsave.renameLoadout", async (arg: unknown) => {
      const l = library.loadout(idOf(arg) ?? "");
      if (!l) return;
      const name = await vscode.window.showInputBox({ title: `Rename ${l.name}`, value: l.name, validateInput: (v) => (!v.trim() ? "A loadout needs a name" : library.loadouts.some((x) => x.id !== l.id && x.name.toLowerCase() === v.trim().toLowerCase()) ? "There is a loadout with that name already" : undefined) });
      if (!name) return;
      library.rename(l.id, name);
      scan();
    }),
    vscode.commands.registerCommand("redsave.loadoutNotes", async (arg: unknown) => {
      const l = library.loadout(idOf(arg) ?? "");
      if (!l) return;
      const notes = await vscode.window.showInputBox({ title: `Notes for ${l.name}`, prompt: "Shown at the top of its tab and in the side bar's tooltip", value: l.notes });
      if (notes === undefined) return;
      library.setNotes(l.id, notes);
      scan();
    }),
    vscode.commands.registerCommand("redsave.openLoadoutFolder", (arg: unknown) => {
      const id = idOf(arg);
      if (id) void vscode.env.openExternal(vscode.Uri.file(library.dirOf(id)));
    }),
    vscode.commands.registerCommand("redsave.removeLoadout", async (arg: unknown) => {
      const l = library.loadout(idOf(arg) ?? "");
      if (!l) return;
      const n = countIn(l.id);
      if (n) {
        const b = await vscode.window.showWarningMessage(`${l.name} has ${plural(n, "save")}. A loadout is removed only when it is empty.`, { modal: true, detail: "Move its saves to the game or another loadout first. Nothing is deleted." }, "Move all to...");
        if (b === "Move all to...") await moveSaves(records.filter((r) => r.where === l.id).map((r) => r.dir), undefined, "");
        return;
      }
      const ok = await vscode.window.showWarningMessage(`Remove the empty loadout ${l.name}?`, { modal: true }, "Remove");
      if (ok !== "Remove") return;
      try {
        library.remove(l.id);
        tabs.get(l.id)?.close();
        scan();
      } catch (err) {
        void vscode.window.showErrorMessage((err as Error).message);
      }
    }),
    vscode.commands.registerCommand("redsave.undoMove", () => undo()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("redsave.libraryPath")) {
        library = new Library(libraryPath());
        for (const t of tabs.values()) t.close();
      }
      if (e.affectsConfiguration("redsave.savesPath") || e.affectsConfiguration("redsave.libraryPath")) {
        scan();
        watch();
      }
    }),
    { dispose: () => (index.unwatch(), names.stop()) },
  );

  // A move cut short last time is finished before anything else.
  const done = recover(library);
  if (done) {
    log.appendLine(`Finished a move cut short (${done.label}): ${done.finished} moved, ${done.failed.length} failed`);
    const failed = done.failed.length ? ` ${plural(done.failed.length, "save")} could not be moved: ${done.failed.map((f) => `${path.basename(f.from)} (${f.error})`).join("; ")}.` : "";
    void vscode.window.showWarningMessage(`REDsave finished a move that was cut short: ${done.label}. ${plural(done.finished, "save")} moved.${failed}`);
  }
  scan();
  watch();
}

export function deactivate(): void {}
