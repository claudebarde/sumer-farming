/** Shared achievement catalogue: server eligibility and Guide requirements. */
export const ACHIEVEMENT_TREASURES = [
  {
    id: 'golden-drinking-cup',
    item: 'Golden drinking cup',
    requirements: ['Produce 500 beer jars', 'Fulfil 25 merchant requests containing beer'],
  },
  {
    id: 'patterned-reed-chest',
    item: 'Patterned reed chest',
    requirements: ['Harvest 500 fields (barley and sesame combined)', 'Prepare 100 meals', 'Fulfil 50 merchant requests'],
  },
  {
    id: 'fine-household-pottery-set',
    item: 'Fine household pottery set',
    requirements: ['Earn 25,000 lifetime points'],
  },
  {
    id: 'painted-large-jar',
    item: 'Painted large jar (replaces the regular large jar)',
    requirements: ['Prepare 50 meals'],
  },
] as const;

export type AchievementKey = typeof ACHIEVEMENT_TREASURES[number]["id"];
export type AchievementHistory = { readonly beer: number; readonly beerRequests: number; readonly harvests: number; readonly meals: number; readonly requests: number; readonly points: number };
export const earnedAchievements = (history: AchievementHistory): readonly AchievementKey[] => [
  ...(history.beer >= 500 && history.beerRequests >= 25 ? ["golden-drinking-cup" as const] : []),
  ...(history.harvests >= 500 && history.meals >= 100 && history.requests >= 50 ? ["patterned-reed-chest" as const] : []),
  ...(history.points >= 25000 ? ["fine-household-pottery-set" as const] : []),
  ...(history.meals >= 50 ? ["painted-large-jar" as const] : []),
];
