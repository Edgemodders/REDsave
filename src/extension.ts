// REDsave's extension: for now, the Saves view counts the saves in the game's folder by kind.
// The save browser, loadouts and titles come in phases S1 to S3 (docs/design.md).
import * as vscode from "vscode";
import { defaultSavesPath, KIND_NAMES, listSaves, SaveKind } from "./saves";

function savesPath(): string {
  return vscode.workspace.getConfiguration("redsave").get<string>("savesPath")?.trim() || defaultSavesPath();
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

  getChildren(): vscode.TreeItem[] {
    const saves = listSaves(savesPath());
    // No items: the view shows its welcome text (the folder was not found).
    if (!saves.length) return [];
    const counts = new Map<SaveKind, number>();
    for (const s of saves) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
    return [...counts].map(([kind, n]) => {
      const item = new vscode.TreeItem(KIND_NAMES[kind]);
      item.description = String(n);
      item.iconPath = new vscode.ThemeIcon("save");
      return item;
    });
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const view = new SavesView();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("redsave.saves", view),
    vscode.commands.registerCommand("redsave.refresh", () => view.refresh()),
    vscode.commands.registerCommand("redsave.openSavesFolder", () => vscode.env.openExternal(vscode.Uri.file(savesPath()))),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("redsave.savesPath")) view.refresh();
    }),
  );
}

export function deactivate(): void {}
