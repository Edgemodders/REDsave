// The Saves page: one webview panel that shows every indexed save, with the search box, chips,
// sort, groups, selection and details. The search runs in the page (webview/page.ts, over
// src/search.ts); this side sends it the records, the names and the pictures' addresses.
import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { SaveRecord } from "./metadata";
import type { NamesStatus } from "./names";

export interface PageData {
  records: SaveRecord[];
  names: Record<string, string | null>;
  status: NamesStatus;
  savesDir: string;
  scan: { count: number; read: number; ms: number };
}

/** What the page sends back. */
type FromPage = { type: "ready" } | { type: "reveal"; dirs: string[] } | { type: "openFolder" } | { type: "copy"; text: string };

export class SavesPage {
  private panel?: vscode.WebviewPanel;
  private ready = false;
  private queued: unknown[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly data: () => PageData,
    private readonly openFolder: () => void,
  ) {}

  /** Opens the page, or brings it forward; with a query, puts it in the search box. */
  show(query?: string): void {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.ready = false;
      const savesDir = vscode.Uri.file(this.data().savesDir);
      this.panel = vscode.window.createWebviewPanel("redsave.page", "Saves", vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist"), vscode.Uri.joinPath(this.extensionUri, "media"), savesDir],
      });
      this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, "docs", "assets", "brand", "icon.png");
      this.panel.webview.html = this.html(this.panel.webview);
      this.panel.webview.onDidReceiveMessage((m: FromPage) => this.onMessage(m));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.ready = false;
        this.queued = [];
      });
    }
    if (query !== undefined) this.post({ type: "query", text: query });
  }

  /** Sends the page everything again (after a scan). */
  refresh(): void {
    if (this.panel) this.post(this.payload());
  }

  /** Sends only the names (after REDbridge answered). */
  names(names: Record<string, string | null>, status: NamesStatus): void {
    if (this.panel) this.post({ type: "names", names, status });
  }

  private payload() {
    const d = this.data();
    const webview = this.panel!.webview;
    // The pictures are shown from the save folder itself, by webview address.
    const records = d.records.map((r) => ({ ...r, shot: r.screenshot ? webview.asWebviewUri(vscode.Uri.file(r.screenshot)).toString() : undefined }));
    return { type: "data", records, names: d.names, status: d.status, savesDir: d.savesDir, scan: d.scan };
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
        // One save: its folder selected in Explorer. Several: the save folder they are in.
        if (m.dirs.length === 1) void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(m.dirs[0]));
        else this.openFolder();
        break;
      case "openFolder":
        this.openFolder();
        break;
      case "copy":
        void vscode.env.clipboard.writeText(m.text);
        void vscode.window.setStatusBarMessage("REDsave: copied", 2000);
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
