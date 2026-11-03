// Where Cyberpunk 2077 is installed, for REDbridge's --game. From EDGEdeck's src/game.ts (same
// owner, MIT): Steam libraries, GOG, Epic. The redsave.gamePath setting comes first.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

export const isGameFolder = (dir: string) => fs.existsSync(path.join(dir, "bin", "x64", "Cyberpunk2077.exe"));

/** A registry string value, or undefined. */
function regValue(key: string, name: string): string | undefined {
  try {
    const out = execFileSync("reg.exe", ["query", key, "/v", name], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const m = new RegExp(`${name}\\s+REG_\\w+\\s+(.+)`).exec(out);
    return m?.[1].trim();
  } catch {
    return undefined;
  }
}

/** Every Steam library folder, from steamapps/libraryfolders.vdf. */
export function steamLibraries(): string[] {
  const roots = [regValue("HKCU\\Software\\Valve\\Steam", "SteamPath"), regValue("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"), "C:\\Program Files (x86)\\Steam"]
    .filter((r): r is string => !!r)
    .map((r) => r.replace(/\//g, "\\"));
  const libs = new Set<string>();
  for (const r of roots) {
    libs.add(r);
    const vdf = path.join(r, "steamapps", "libraryfolders.vdf");
    if (!fs.existsSync(vdf)) continue;
    for (const m of fs.readFileSync(vdf, "utf8").matchAll(/"path"\s+"([^"]+)"/g)) libs.add(m[1].replace(/\\\\/g, "\\"));
  }
  return [...libs];
}

/** Where Cyberpunk 2077 is installed: the setting, Steam libraries, GOG, Epic. */
export function findGame(configured?: string): string | undefined {
  if (configured && isGameFolder(configured)) return configured;
  const candidates = [
    ...steamLibraries().map((l) => path.join(l, "steamapps", "common", "Cyberpunk 2077")),
    regValue("HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\1423049311", "path"),
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Epic Games", "Cyberpunk 2077"),
    path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "GOG Galaxy", "Games", "Cyberpunk 2077"),
  ].filter((c): c is string => !!c);
  return candidates.find(isGameFolder);
}
