import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RulesPage from '../../src/client/features/rules/RulesPage';
import { RULE_SECTIONS } from '../../src/client/features/rules/guide';
import { buildingRuleSections, rulesHref, tileRuleSection } from '../../src/client/features/rules/links';
import { farmBuildingTypes } from '../../src/game-data/buildings';

describe('standalone rules reference', () => {
  it('renders every deep-link destination without a game session', () => {
    const html = renderToStaticMarkup(createElement(RulesPage));
    const ids = RULE_SECTIONS.map(section => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
    for (const type of farmBuildingTypes) expect(ids).toContain(buildingRuleSections[type]);
    expect(html).toContain('Game rules');
    expect(html).toContain('Find a rule');
  });
  it('routes crop and output links to their relevant rules', () => {
    expect(rulesHref('bread-oven')).toBe('/rules#bread-oven');
    expect(tileRuleSection('Ripe sesame')).toBe('sesame');
    expect(tileRuleSection('Date palm')).toBe('date-palm');
    expect(tileRuleSection('Bread basket')).toBe('bread-oven');
    expect(tileRuleSection('Flour bags')).toBe('mill');
    expect(tileRuleSection('Oil jars')).toBe('oil-mill');
  });
});
