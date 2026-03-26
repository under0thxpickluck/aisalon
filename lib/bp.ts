export function calcArticleBP(length: number): number {
  if (length <= 4000) return 18;
  if (length <= 8000) return 32;
  if (length <= 12000) return 48;
  return 60;
}

export const BP_COSTS = {
  plan: 8,
  title_regen: 2,
  intro_regen: 3,
  section_regen: 4,
  thumbnail: 8,
};
