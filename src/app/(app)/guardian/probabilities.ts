// 확률 계산 (클라이언트용 순수 함수)
export function calcProbabilities(
  periodDays: number,
  achievement: number,
  careBonus: number,
  potion?: { rare_mult: number; epic_mult: number; unique_mult: number; normal_guarantee?: boolean }
) {
  if (potion?.normal_guarantee) {
    return { normal: 100, rare: 0, epic: 0, unique: 0 };
  }

  const baseProbMap: Record<number, [number, number, number]> = {
    3: [1, 4, 15], 7: [2, 7, 20], 10: [3, 10, 25], 15: [5, 14, 30], 30: [8, 20, 35],
  };
  const [bUnique, bEpic, bRare] = baseProbMap[periodDays] || [1, 4, 15];

  const mult = 0.5 + (achievement / 100);
  let pUnique = bUnique * mult;
  let pEpic = bEpic * mult;
  let pRare = bRare * mult;

  const careMult = 1 + (careBonus / 100);
  pUnique *= careMult;

  if (potion) {
    pRare *= potion.rare_mult;
    pEpic *= potion.epic_mult;
    pUnique *= potion.unique_mult;
  }

  const pNormal = Math.max(0, 100 - pUnique - pEpic - pRare);

  return {
    normal: Math.round(pNormal * 100) / 100,
    rare: Math.round(pRare * 100) / 100,
    epic: Math.round(pEpic * 100) / 100,
    unique: Math.round(pUnique * 100) / 100,
  };
}
