export const rulesHref = (section = 'getting-started') => `/rules#${section}`;
export const buildingRuleSections: Record<string, string> = { farm: 'farm', granary: 'granary', mill: 'mill', oilMill: 'oil-mill', breadOven: 'bread-oven', brewery: 'brewery', smallShrine: 'small-shrine', warehouse: 'warehouse', kitchen: 'kitchen' };
export const tileRuleSection = (title: string): string => {
  const value = title.toLowerCase();
  if (value.includes('oil')) return 'oil-mill';
  if (value.includes('flour') || value.includes('groats')) return 'mill';
  if (value.includes('bread')) return 'bread-oven';
  if (value.includes('beer')) return 'brewery';
  if (value.includes('palm') || value.includes('date')) return 'date-palm';
  if (value.includes('sesame')) return 'sesame';
  if (value.includes('barley')) return 'barley';
  if (value.includes('road') || value.includes('canal') || value.includes('arable')) return 'roads';
  return 'gathering';
};
