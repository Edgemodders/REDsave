// The Saves page and each loadout's tab: webview panels that show indexed saves, with the search
// box, chips, sort, groups, selection and details. The search runs in the page (webview/page.ts,
// over src/search.ts); this side sends it the records, the names, the places and the pictures'
// addresses, and takes back what the player asked for (show in folder, copy, move).
import * as vscode from "vscode";
import * as crypto from "node:crypto";
import * as path from "node:path";
import type { SaveRecord } from "./metadata";
import type { NamesStatus } from "./names";

export interface PageData {
  records: SaveRecord[];
  names: Record<string, string | null>;
  status: NamesStatus;
  savesDir: string;
  libraryDir: string;
  scan: { count: number; read: number; ms: number };
  /** Loadout id to name. */
  places: Record<string, string>;
  /** The loadout in the game: it owns the saves in the game's folder. */
  inGame: string | null;
  /** A loadout by its id: for its tab's header. */
  loadout: (id: string) => { name: string; notes: string; count: number; bytes: number; inGame: boolean } | undefined;
}

export interface PageActions {
  openFolder: () => void;
  /** The player pressed Move to loadout..., Move to... or Add to <loadout>. */
  move: (dirs: string[], target: string | undefined, query: string) => void;
  /** The player pressed Swap in on a loadout's tab. */
  swap: (id: string) => void;
  /** Set title... (one save), Add to titles... (several) or Reset title. */
  title: (dirs: string[], mode: "set" | "add" | "reset") => void;
}

/** What a page sends back. */
type FromPage =
  | { type: "ready" }
  | { type: "reveal"; dirs: string[] }
  | { type: "openFolder" }
  | { type: "copy"; text: string }
  | { type: "move"; dirs: string[]; target?: string; query: string }
  | { type: "swap" }
  | { type: "title"; dirs: string[]; mode: "set" | "add" | "reset" };

export class SavesPage {
  private panel?: vscode.WebviewPanel;
  private ready = false;
  private queued: unknown[] = [];

  /** scope: undefined for the Saves page, a loadout's id for its tab. */
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly scope: string | undefined,
    private readonly data: () => PageData,
    private readonly actions: PageActions,
    private readonly closed: () => void = () => {},
  ) {}

  private title(): string {
    return this.scope ? this.data().places[this.scope] ?? "Loadout" : "Saves";
  }

  /** Opens the page, or brings it forward; with a query, puts it in the search box. */
  show(query?: string): void {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.ready = false;
      const d = this.data();
      this.panel = vscode.window.createWebviewPanel(this.scope ? "redsave.loadout" : "redsave.page", this.title(), vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        // pictures are shown from where the saves are: the game's folder and the library
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist"), vscode.Uri.joinPath(this.extensionUri, "media"), vscode.Uri.file(d.savesDir), vscode.Uri.file(d.libraryDir)],
      });
      this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, "docs", "assets", "brand", "icon.png");
      this.panel.webview.html = this.html(this.panel.webview);
      this.panel.webview.onDidReceiveMessage((m: FromPage) => this.onMessage(m));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.ready = false;
        this.queued = [];
        this.closed();
      });
    }
    if (query !== undefined) this.post({ type: "query", text: query });
  }

  get isOpen(): boolean {
    return !!this.panel;
  }

  close(): void {
    this.panel?.dispose();
  }

  /** Sends the page everything again (after a scan); moved: after a move this page started. */
  refresh(moved = false): void {
    if (!this.panel) return;
    this.panel.title = this.title();
    this.post({ ...this.payload(), moved });
  }

  /** Sends only the names (after REDbridge answered). */
  names(names: Record<string, string | null>, status: NamesStatus): void {
    if (this.panel) this.post({ type: "names", names, status });
  }

  private payload() {
    const d = this.data();
    const webview = this.panel!.webview;
    const records = d.records.map((r) => ({ ...r, shot: r.screenshot ? webview.asWebviewUri(vscode.Uri.file(r.screenshot)).toString() : undefined }));
    return {
      type: "data",
      records,
      names: d.names,
      status: d.status,
      savesDir: d.savesDir,
      scan: d.scan,
      scope: this.scope,
      places: d.places,
      inGame: d.inGame,
      loadout: this.scope ? d.loadout(this.scope) : undefined,
    };
  }

  private post(message: unknown): void {
    if (!this.ready) {
      this.queued.push(message);
      return;
    }
    void this.panel?.webview.postMessage(message);
  }

  private onMessage(m: FromPage): void {
    switch (m.type) {
      case "ready":
        this.ready = true;
        void this.panel?.webview.postMessage(this.payload());
        for (const q of this.queued.filter((x) => (x as { type: string }).type !== "data")) void this.panel?.webview.postMessage(q);
        this.queued = [];
        break;
      case "reveal":
        // One save: its folder selected in Explorer. Several: the folder of the first.
        if (m.dirs.length === 1) void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(m.dirs[0]));
        else if (m.dirs.length) void vscode.env.openExternal(vscode.Uri.file(path.dirname(m.dirs[0])));
        else this.actions.openFolder();
        break;
      case "openFolder":
        this.actions.openFolder();
        break;
      case "copy":
        void vscode.env.clipboard.writeText(m.text);
        void vscode.window.setStatusBarMessage("REDsave: copied", 2000);
        break;
      case "move":
        this.actions.move(m.dirs, m.target, m.query);
        break;
      case "swap":
        if (this.scope) this.actions.swap(this.scope);
        break;
      case "title":
        this.actions.title(m.dirs, m.mode);
        break;
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString("base64");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "page.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "page.css"));
    const csp = [`default-src 'none'`, `img-src ${webview.cspSource}`, `style-src ${webview.cspSource}`, `script-src 'nonce-${nonce}'`].join("; ");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${style}">
<title>Saves</title>
</head>
<body>
<div id="app"><p class="empty">Reading saves...</p></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}
