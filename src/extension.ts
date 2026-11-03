// REDsave's extension. S1, Find: the index of every save in the game's save folder, the Saves page
// (search, chips, sort, groups, selection, details) and the side bar's counts. Read only: nothing
// is written to the save folder. Loadouts (S2) and titles (S3) come later (docs/design.md).
import * as vscode from "vscode";
import * as path from "node:path";
import { defaultSavesPath, KIND_NAMES, SaveKind } from "./saves";
import { SaveIndex } from "./index";
import { Names } from "./names";
import { findGame } from "./game";
import { SavesPage } from "./page";
import { playthroughLabel, playthroughsOf } from "./search";
import type { SaveRecord } from "./metadata";

const KIND_WORDS: Record<SaveKind, string> = { manual: "manual", auto: "auto", quick: "quick", pointOfNoReturn: "ponr", endGame: "endgame" };

let log: vscode.OutputChannel;
let index: SaveIndex;
let names: Names;
let records: SaveRecord[] = [];
let scanInfo = { count: 0, read: 0, ms: 0 };

const config = () => vscode.workspace.getConfiguration("redsave");
const savesPath = () => config().get<string>("savesPath")?.trim() || defaultSavesPath();

/** The game folder for REDbridge: the setting, EDGEdeck's when it runs, else Steam, GOG or Epic. */
function gameDir(): string | undefined {
  const deck = vscode.extensions.getExtension("edgemodders.edgedeck");
  const fromDeck = deck?.isActive ? (deck.exports as { gamePath?: () => string | undefined })?.gamePath?.() : undefined;
  return findGame(config().get<string>("gamePath")?.trim() || fromDeck);
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
    // No items: the view shows its welcome text (no saves found).
    if (!records.length) return [];
    const open = (query: string) => ({ command: "redsave.openPage", title: "Open", arguments: [query] });
    if (parent?.id === "playthroughs") {
      return [...playthroughsOf(records).values()]
        .sort((a, b) => a.number - b.number)
        .map((p) => {
          const item = new vscode.TreeItem(playthroughLabel(p));
          item.description = String(p.count);
          item.iconPath = new vscode.ThemeIcon("person");
          item.command = open(`playthrough:${p.number}`);
          return item;
        });
    }
    if (parent) return [];
    const page = new vscode.TreeItem("Open the Saves page");
    page.iconPath = new vscode.ThemeIcon("search");
    page.description = `${records.length} saves`;
    page.command = open("");
    const counts = new Map<SaveKind, number>();
    for (const r of records) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    const kinds = [...counts].map(([kind, n]) => {
      const item = new vscode.TreeItem(KIND_NAMES[kind]);
      item.description = String(n);
      item.iconPath = new vscode.ThemeIcon("save");
      item.command = open(`kind:${KIND_WORDS[kind]}`);
      return item;
    });
    const pts = new vscode.TreeItem("Playthroughs", vscode.TreeItemCollapsibleState.Collapsed);
    pts.id = "playthroughs";
    pts.iconPath = new vscode.ThemeIcon("history");
    return [page, ...kinds, pts];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  log = vscode.window.createOutputChannel("REDsave");
  const store = context.globalStorageUri.fsPath;
  index = new SaveIndex(path.join(store, "index.json"));
  names = new Names(store, "en-us", (line) => log.appendLine(line));
  const view = new SavesView();
  const openFolder = () => void vscode.env.openExternal(vscode.Uri.file(savesPath()));
  const page = new SavesPage(context.extensionUri, () => ({ records, names: names.known, status: names.status, savesDir: savesPath(), scan: scanInfo }), openFolder);

  const scan = () => {
    const dir = savesPath();
    const r = index.scan(dir);
    records = r.records;
    scanInfo = { count: r.records.length, read: r.read, ms: r.ms };
    log.appendLine(`${dir}: ${r.records.length} saves, ${r.read} read from their files, in ${r.ms} ms`);
    view.refresh();
    page.refresh();
    const keys = records.flatMap((x) => [x.trackedQuest, x.mainQuest, x.location]).filter((k): k is string => !!k);
    void names.resolve(keys, gameDir()).then(() => {
      if (names.status.state !== "ready") log.appendLine(names.status.text);
      page.names(names.known, names.status);
    });
  };
  const watch = () => index.watch(savesPath(), scan);

  context.subscriptions.push(
    log,
    vscode.window.registerTreeDataProvider("redsave.saves", view),
    vscode.commands.registerCommand("redsave.openPage", (query?: string) => page.show(typeof query === "string" ? query : undefined)),
    vscode.commands.registerCommand("redsave.refresh", scan),
    vscode.commands.registerCommand("redsave.openSavesFolder", openFolder),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("redsave.savesPath")) {
        scan();
        watch();
      }
    }),
    { dispose: () => (index.unwatch(), names.stop()) },
  );
  scan();
  watch();
}

export function deactivate(): void {}
