// One save's metadata (metadata.<n>.json), read into the record REDsave indexes and searches.
// Fields the file lacks stay undefined, shown as unknown, never as false or 0. Read only.
import * as fs from "node:fs";
import * as path from "node:path";
import type { SaveFolder, SaveKind } from "./saves";

export interface SaveRecord {
  /** The save folder's path: the record's key. */
  dir: string;
  /** The folder's name, ManualSave-12. */
  name: string;
  kind: SaveKind;
  /** Where the save is: "game" (the game's save folder); a loadout's id from S2. */
  where: string;
  /** When it was saved, as milliseconds since 1970: timestampString, else sav.dat's time. */
  time: number;
  /** The metadata's timestampString as the game wrote it. */
  timestamp?: string;
  /** The game's quest title (a LocKey), or the player's own title written as plain text (S3). */
  trackedQuest?: string;
  /** The save's own quest title (its LocKey) when REDsave gave it a title: kept in its metadata's userName. */
  originalQuest?: string;
  /** The tracked quest's id from trackedQuestEntry (mq062_clampdown), the title when no name is read. */
  questId?: string;
  mainQuest?: string;
  location?: string;
  lifePath?: string;
  body?: string;
  voice?: string;
  level?: number;
  streetCred?: number;
  attributes?: { body?: number; intelligence?: number; reflexes?: number; technical?: number; cool?: number };
  difficulty?: string;
  /** Seconds. */
  playTime?: number;
  playthroughId?: string;
  patch?: string;
  gameVersion?: number;
  saveVersion?: number;
  phantomLiberty?: boolean;
  pointOfNoReturn?: boolean;
  endGame?: boolean;
  modded?: boolean;
  finishedQuests: string[];
  /** Quest facts as "name=value". */
  facts: string[];
  fileSize?: number;
  /** screenshot.png's path, when the save has one. */
  screenshot?: string;
  /** The metadata file's name (metadata.9.json), or undefined when it is missing or unreadable. */
  metadataFile?: string;
  /** Why the metadata could not be read, when it could not. */
  problem?: string;
}

/** The prefix REDsave writes before the save's own quest in its metadata's userName (titles.ts). */
export const ORIGINAL_PREFIX = "REDsave:";
/** The save's own quest (its LocKey) when REDsave has titled it, from the metadata's userName. */
export function originalOf(userName: string | undefined): string | undefined {
  return userName?.startsWith(ORIGINAL_PREFIX) ? userName.slice(ORIGINAL_PREFIX.length) : undefined;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/**
 * The game's timestampString, "18:03:12, 3.11.2026": the time, then day.month.year. All 970 saves
 * on the dev PC (2026-11-03) were written so and matched sav.dat's time; other Windows locales are
 * unverified, so a string of another shape gives undefined and the file's time is used.
 */
export function parseTimestamp(text: string | undefined): number | undefined {
  const m = /^(\d{1,2}):(\d{2}):(\d{2}),\s*(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text?.trim() ?? "");
  if (!m) return undefined;
  const [h, min, s, d, mo, y] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23) return undefined;
  return new Date(y, mo - 1, d, h, min, s).getTime();
}

/** "quests/minor_quest/mq062_clampdown/mq062_hook/..." gives "mq062_clampdown". */
export function questIdOf(entry: string | undefined): string | undefined {
  const parts = entry?.split("/").filter(Boolean) ?? [];
  return parts[0] === "quests" ? parts[2] : parts[0];
}

/** A record from a metadata file's parsed JSON, for a save folder. */
export function recordFrom(json: unknown, folder: SaveFolder, where: string, fileTime: number, screenshot?: string): SaveRecord {
  const m = ((json as { Data?: { metadata?: Record<string, unknown> } })?.Data?.metadata ?? {}) as Record<string, unknown>;
  const timestamp = str(m.timestampString);
  const attributes = {
    body: num(m.strength),
    intelligence: num(m.intelligence),
    reflexes: num(m.reflexes),
    technical: num(m.technicalAbility),
    cool: num(m.cool),
  };
  const extra = Array.isArray(m.additionalContentIds) ? m.additionalContentIds.map(String) : undefined;
  return {
    dir: folder.dir,
    name: folder.name,
    kind: folder.kind,
    where,
    time: parseTimestamp(timestamp) ?? fileTime,
    timestamp,
    trackedQuest: str(m.trackedQuest),
    originalQuest: originalOf(typeof m.userName === "string" ? m.userName : undefined),
    questId: questIdOf(str(m.trackedQuestEntry)),
    mainQuest: str(m.mainQuest),
    location: str(m.locationName),
    lifePath: str(m.lifePath),
    body: str(m.bodyGender),
    voice: str(m.brainGender),
    level: num(m.level),
    streetCred: num(m.streetCred),
    attributes: Object.values(attributes).some((v) => v !== undefined) ? attributes : undefined,
    difficulty: str(m.difficulty),
    playTime: num(m.playTime),
    playthroughId: str(m.playthroughID),
    patch: str(m.buildPatch),
    gameVersion: num(m.gameVersion),
    saveVersion: num(m.saveVersion),
    phantomLiberty: extra ? extra.includes("EP1") : undefined,
    pointOfNoReturn: bool(m.isPointOfNoReturn),
    endGame: bool(m.isEndGameSave),
    modded: bool(m.isModded),
    finishedQuests: str(m.finishedQuests)?.split(/\s+/) ?? [],
    facts: Array.isArray(m.facts) ? m.facts.filter((f): f is string => typeof f === "string") : [],
    fileSize: num(m.fileSize),
    screenshot,
    // either slash: the Check workflow runs the tests on Linux with Windows paths
    metadataFile: folder.metadataFile?.split(/[\\/]/).pop(),
  };
}

/** Reads a save folder's metadata into a record. A missing or broken file gives a record with only the folder's facts and a problem. */
export function readSave(folder: SaveFolder, where = "game"): SaveRecord {
  const sav = path.join(folder.dir, "sav.dat");
  let fileTime = 0;
  try {
    fileTime = fs.statSync(sav).mtimeMs;
  } catch {
    // listSaves only lists folders with sav.dat; it may have gone since
  }
  const shot = path.join(folder.dir, "screenshot.png");
  const screenshot = fs.existsSync(shot) ? shot : undefined;
  if (!folder.metadataFile) return { ...recordFrom({}, folder, where, fileTime, screenshot), problem: "No metadata file" };
  try {
    return recordFrom(JSON.parse(fs.readFileSync(folder.metadataFile, "utf8")), folder, where, fileTime, screenshot);
  } catch (err) {
    return { ...recordFrom({}, folder, where, fileTime, screenshot), problem: `The metadata could not be read: ${(err as Error).message}` };
  }
}
