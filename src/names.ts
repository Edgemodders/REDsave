// Names for the LocKeys saves use (tracked quest, main quest, place), read through REDbridge from
// the player's own copy of the game. REDsave ships no names: they are game data. REDbridge is
// found where REDnode, EDGEdeck or REDcode installed it (REDnode's packages/overlay/redbridge.js
// has the same lookup); without it, saves show their quest's id. Names are kept in REDsave's global
// storage on the player's PC, one file per language.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, ChildProcess } from "node:child_process";

const EDITORS = ["Code", "Code - Insiders", "VSCodium", "EDGEkit", "Cursor"];
// EDGEdeck, then REDcode under each id it has had.
const EXTENSIONS = ["edgemodders.edgedeck", "edgemodders.redcode-cyberpunk", "edgemodders.redcode", "edgemodders.redcode-core"];
const IDLE_MS = 2 * 60 * 1000;
const BATCH = 500;

export interface BridgeCopy {
  exe: string;
  version?: string;
  source: string;
}

function compareVersions(a = "", b = ""): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

function copiesIn(dir: string, source: string): BridgeCopy[] {
  let tags: string[] = [];
  try {
    tags = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return tags
    .filter((t) => !t.startsWith(".") && isFile(path.join(dir, t, "REDbridge.exe")))
    .map((t) => ({ exe: path.join(dir, t, "REDbridge.exe"), version: t.replace(/^v/, ""), source }));
}

/** The newest REDbridge.exe on this PC: REDBRIDGE_EXE, then REDnode's, EDGEdeck's and REDcode's copies. */
export function findRedbridge(): BridgeCopy | undefined {
  const env = process.env.REDBRIDGE_EXE;
  if (env && isFile(env)) return { exe: env, source: "REDBRIDGE_EXE" };
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  const copies = copiesIn(path.join(local, "REDnode", "bridge"), "REDnode");
  for (const editor of EDITORS) {
    for (const ext of EXTENSIONS) {
      copies.push(...copiesIn(path.join(appData, editor, "User", "globalStorage", ext, "bridge"), `${ext === EXTENSIONS[0] ? "EDGEdeck" : "REDcode"} (${editor})`));
    }
  }
  return copies.sort((a, b) => compareVersions(b.version, a.version))[0];
}

/** A .NET 10 runtime: machine-wide, or the per-user one REDnode, EDGEdeck or REDcode installed. */
export function dotnet10(): { root: string; machine: boolean } | undefined {
  const has = (root: string) => {
    try {
      return fs.readdirSync(path.join(root, "shared", "Microsoft.NETCore.App")).some((v) => v.startsWith("10."));
    } catch {
      return false;
    }
  };
  const machine = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "dotnet");
  if (has(machine)) return { root: machine, machine: true };
  const user = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Microsoft", "dotnet");
  return has(user) ? { root: user, machine: false } : undefined;
}

/** REDbridge over its stdio: JSON-RPC 2.0, Content-Length framed. Started on the first call, stopped when idle. */
class Bridge {
  private child?: ChildProcess;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private idle?: NodeJS.Timeout;

  constructor(
    private readonly copy: BridgeCopy,
    private readonly gameDir: string,
    private readonly log: (line: string) => void,
  ) {}

  private start(): void {
    if (this.child) return;
    const runtime = dotnet10();
    if (!runtime) throw new Error("REDbridge needs the .NET 10 runtime, which EDGEdeck's Get REDbridge or REDcode's Install REDbridge installs");
    const env = { ...process.env };
    if (!runtime.machine) env.DOTNET_ROOT = runtime.root;
    this.log(`REDbridge ${this.copy.version ?? ""} from ${this.copy.source}: ${this.copy.exe}`);
    const child = spawn(this.copy.exe, ["--game", this.gameDir], { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    this.buffer = Buffer.alloc(0);
    child.stdout!.on("data", (c: Buffer) => this.onData(c));
    child.stderr!.on("data", () => {}); // its log; not needed here
    child.on("error", (err) => this.log(`REDbridge could not start: ${err.message}`));
    child.on("exit", (code) => {
      if (this.child === child) this.child = undefined;
      for (const p of this.pending.values()) p.reject(new Error(`REDbridge ended (code ${code})`));
      this.pending.clear();
    });
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const end = this.buffer.indexOf("\r\n\r\n");
      if (end < 0) return;
      const m = /Content-Length:\s*(\d+)/i.exec(this.buffer.subarray(0, end).toString("ascii"));
      if (!m) {
        this.buffer = this.buffer.subarray(end + 4);
        continue;
      }
      const length = Number(m[1]);
      if (this.buffer.length < end + 4 + length) return;
      const body = this.buffer.subarray(end + 4, end + 4 + length).toString("utf8");
      this.buffer = this.buffer.subarray(end + 4 + length);
      let msg: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        msg = JSON.parse(body);
      } catch {
        continue;
      }
      const p = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
      if (!p) continue;
      this.pending.delete(msg.id!);
      if (msg.error) p.reject(new Error(msg.error.message ?? "REDbridge error"));
      else p.resolve(msg.result);
    }
  }

  call(method: string, params: object): Promise<unknown> {
    this.start();
    clearTimeout(this.idle);
    this.idle = setTimeout(() => this.stop(), IDLE_MS);
    const id = this.nextId++;
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, method, params }), "utf8");
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child!.stdin!.write(`Content-Length: ${body.length}\r\n\r\n`);
      this.child!.stdin!.write(body);
    });
  }

  stop(): void {
    clearTimeout(this.idle);
    this.child?.kill();
    this.child = undefined;
  }
}

export interface NamesStatus {
  /** "ready": names come from REDbridge; "missing": no REDbridge, .NET or game folder; "failed": REDbridge answered with an error. */
  state: "ready" | "missing" | "failed" | "working";
  text: string;
}

interface LocEntry {
  female?: string;
  male?: string;
}

/** LocKey names, kept per language, asked of REDbridge for the keys not known yet. */
export class Names {
  private names: Record<string, string | null> = {};
  private bridge?: Bridge;
  status: NamesStatus = { state: "working", text: "Looking for REDbridge" };

  constructor(
    private readonly storeDir: string,
    private readonly language: string,
    private readonly log: (line: string) => void,
  ) {
    try {
      this.names = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      // none kept yet
    }
  }

  private get file(): string {
    return path.join(this.storeDir, `names-${this.language}.json`);
  }

  /** Every name known, LocKey to text (null for a key with no text). */
  get known(): Record<string, string | null> {
    return this.names;
  }

  /** Asks REDbridge for the keys not known yet. Resolves with whether anything new was learnt. */
  async resolve(keys: Iterable<string>, gameDir: string | undefined): Promise<boolean> {
    const wanted = [...new Set(keys)].filter((k) => k && !(k in this.names));
    if (!wanted.length) {
      if (this.status.state === "working") this.status = { state: "ready", text: "Names from your game, through REDbridge" };
      return false;
    }
    const copy = findRedbridge();
    if (!copy) return this.missing("REDbridge is not installed, so saves show their quest's id. Get it with EDGEdeck's Get REDbridge or REDcode's Install REDbridge.");
    if (!gameDir) return this.missing("The game folder was not found, so REDbridge cannot read names. Set redsave.gamePath.");
    if (!dotnet10()) return this.missing("REDbridge needs the .NET 10 runtime: EDGEdeck's Get REDbridge or REDcode's Install REDbridge installs it.");
    this.bridge ??= new Bridge(copy, gameDir, this.log);
    this.status = { state: "working", text: `Reading ${wanted.length} names through REDbridge` };
    try {
      for (let i = 0; i < wanted.length; i += BATCH) {
        const batch = wanted.slice(i, i + BATCH);
        const got = (await this.bridge.call("loc.get", { keys: batch, language: this.language })) as Record<string, LocEntry | null>;
        for (const k of batch) {
          const e = got?.[k];
          this.names[k] = e ? e.female || e.male || null : null;
        }
      }
      fs.mkdirSync(this.storeDir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.names));
      this.status = { state: "ready", text: `Names from your game, through REDbridge ${copy.version ?? ""}`.trim() };
      return true;
    } catch (err) {
      this.log(`REDbridge loc.get failed: ${(err as Error).message}`);
      this.status = { state: "failed", text: `REDbridge could not read the names: ${(err as Error).message}` };
      return false;
    }
  }

  private missing(text: string): false {
    this.status = { state: "missing", text };
    return false;
  }

  stop(): void {
    this.bridge?.stop();
  }
}
