// lib/music/rights-log.ts
// rightsLog への追記ヘルパー

import type { PostprocessPreset } from "./presets";

export type RightsLogEntry =
  | { type: "lyricsApproved"; humanEdited: boolean }
  | { type: "structureApproved" }
  | { type: "postprocessApplied"; preset: PostprocessPreset; version: string }
  | { type: "postprocessFallbackRaw"; reason: string };

export type RightsLog = {
  lyricsApproved?: boolean;
  humanEdited?: boolean;
  structureApproved?: boolean;
  postprocessApplied?: boolean;
  postprocessPreset?: string;
  postprocessVersion?: string;
  postprocessFallbackRaw?: boolean;
  fallbackReason?: string;
};

export function mergeRightsLog(
  existing: RightsLog | undefined,
  entry: RightsLogEntry
): RightsLog {
  const base = existing ?? {};

  switch (entry.type) {
    case "lyricsApproved":
      return { ...base, lyricsApproved: true, humanEdited: entry.humanEdited };

    case "structureApproved":
      return { ...base, structureApproved: true };

    case "postprocessApplied":
      return {
        ...base,
        postprocessApplied: true,
        postprocessPreset: entry.preset,
        postprocessVersion: entry.version,
      };

    case "postprocessFallbackRaw":
      return {
        ...base,
        postprocessFallbackRaw: true,
        fallbackReason: entry.reason,
      };
  }
}
