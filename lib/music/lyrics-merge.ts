// lib/music/lyrics-merge.ts

export type MergeResult = {
  displayLyrics: string;
  distributionLyrics: string;
  reviewRequired: boolean;
  distributionReady: boolean;
  lyricsSource: "singable" | "asr_merged" | "manual";
};

export function mergeLyricsForDisplay(params: {
  singableLyrics: string;
  asrLyrics: string;
  score: number;
}): MergeResult {
  const { singableLyrics, asrLyrics, score } = params;

  // ケースA (score >= 95): singable をそのまま使用、distributionReady=true
  if (score >= 95) {
    return {
      displayLyrics: singableLyrics,
      distributionLyrics: singableLyrics,
      reviewRequired: false,
      distributionReady: true,
      lyricsSource: "singable",
    };
  }

  // ケースB (85 <= score < 95): conservative merge、distributionReady=true
  if (score >= 85 && score < 95) {
    return {
      displayLyrics: singableLyrics,
      distributionLyrics: singableLyrics,
      reviewRequired: false,
      distributionReady: true,
      lyricsSource: "singable",
    };
  }

  // ケースC (70 <= score < 85): mergedを使用、reviewRequired=true、distributionReady=false
  if (score >= 70 && score < 85) {
    return {
      displayLyrics: singableLyrics,
      distributionLyrics: singableLyrics,
      reviewRequired: true,
      distributionReady: false,
      lyricsSource: "asr_merged",
    };
  }

  // ケースD (score < 70): singableをそのまま、reviewRequired=true、distributionReady=false
  return {
    displayLyrics: singableLyrics,
    distributionLyrics: singableLyrics,
    reviewRequired: true,
    distributionReady: false,
    lyricsSource: "singable",
  };
}
