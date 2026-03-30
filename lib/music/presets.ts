// lib/music/presets.ts

export type PostprocessPreset = "natural" | "warm" | "punch";

export type PresetParams = {
  highCutFreq: number;    // Hz
  highCutGain: number;    // dB (negative = cut)
  lowBoostFreq: number;   // Hz
  lowBoostGain: number;   // dB (positive = boost)
  compressorRatio: number;
  reverbDecay: number;    // 0-1 (maps to aecho decay)
  reverbDelay: number;    // ms
  targetLufs: number;     // e.g. -14
  truePeakTarget: number; // e.g. -1.0
};

export const PRESETS: Record<PostprocessPreset, PresetParams> = {
  natural: {
    highCutFreq: 4000,
    highCutGain: -1.5,
    lowBoostFreq: 110,
    lowBoostGain: 1.0,
    compressorRatio: 1.7,
    reverbDecay: 0.05,
    reverbDelay: 100,
    targetLufs: -14,
    truePeakTarget: -1.0,
  },
  warm: {
    highCutFreq: 4000,
    highCutGain: -2.2,
    lowBoostFreq: 120,
    lowBoostGain: 1.5,
    compressorRatio: 1.9,
    reverbDecay: 0.07,
    reverbDelay: 120,
    targetLufs: -13.5,
    truePeakTarget: -1.0,
  },
  punch: {
    highCutFreq: 4000,
    highCutGain: -1.0,
    lowBoostFreq: 100,
    lowBoostGain: 1.5,
    compressorRatio: 2.2,
    reverbDecay: 0.03,
    reverbDelay: 80,
    targetLufs: -12.5,
    truePeakTarget: -1.0,
  },
};

export function choosePostprocessPreset(params: {
  genre?: string;
  mood?: string;
  structurePreset?: string;
}): PostprocessPreset {
  const combined = [
    params.genre ?? "",
    params.mood ?? "",
    params.structurePreset ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // punch: 激しい・派手・EDM系
  if (/edm|hype|energetic|powerful|激しい|クール|ヒップホップ|hip.hop|rock|ロック/.test(combined)) {
    return "punch";
  }

  // warm: 落ち着いた・感情的・バラード系
  if (/ballad|emotional|chill|calm|切ない|落ち着|ロマンチック|ジャズ|jazz|ローファイ|lo.fi/.test(combined)) {
    return "warm";
  }

  // natural: その他すべて（デフォルト）
  return "natural";
}
