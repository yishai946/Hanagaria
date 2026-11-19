import { describe, expect, it } from 'vitest';
import { normalizePlan, packSheet, stepParts, totals } from './plan';
import { DEMO_PLAN } from './demoPlan';

describe('normalizePlan', () => {
  it('normalizes the demo plan and groups identical parts', () => {
    const p = normalizePlan(DEMO_PLAN);
    expect(p.parts).toHaveLength((DEMO_PLAN.parts as unknown[]).length);
    expect(p.groups.map((g) => [g.name, g.ids.length])).toEqual([['לוח משטח', 6], ['קורה ארוכה', 4], ['שלב מדף', 7], ['קורה קצרה', 4], ['רגל', 4]]);
    expect(p.groups[0]!.letter).toBe('א');
    expect(totals(p).materials).toBe(165 + 60 + 84 + 56 + 25 + 40 + 30 + 96 + 69 + 15);
    expect(stepParts(p, 1).map((x) => x.qty).sort()).toEqual([4, 4]);
  });

  it('never crashes on garbage from the AI and clamps it', () => {
    const p = normalizePlan({ parts: [{ shape: 'box', size: [1, -2, 3] }, { shape: 'cylinder', step: 99, position: 'x' }, null], steps: [{}], shopping: [{ qty: 'a', unitPrice: -5, url: 'javascript:alert(1)' }] });
    expect(p.parts).toHaveLength(1); // invalid box dropped
    expect(p.parts[0]!.step).toBe(0);
    expect(p.parts[0]!.position).toEqual([0, 0, 0]);
    expect(p.shopping[0]!.url).toBe('');
    expect(totals(p).materials).toBe(0);
    expect(normalizePlan(undefined).steps).toHaveLength(1);
  });

  it('keeps only http links; the old difficulty name maps to the new one', () => {
    const p = normalizePlan({ difficulty: 'מתקדם', stores: [{ name: 'ACE', url: 'javascript:x', cutService: 1 }, { url: 'https://a.co' }], simplifications: ['פחות חיבורים', 5] });
    expect(p.difficulty).toBe('קשה');
    expect(p.stores.map((s) => [s.name, s.url, s.cutService])).toEqual([['ACE', '', true]]);
    expect(p.simplifications).toEqual(['פחות חיבורים']);
  });
});

describe('packSheet', () => {
  it('wraps rows and flags overflow', () => {
    const placed = packSheet({ stockLength: 100, stockWidth: 50, cuts: [{ name: 'a', length: 60, width: 30 }, { name: 'b', length: 60, width: 30 }] });
    expect(placed[1]!.x).toBe(0);
    expect(placed[1]!.y).toBeGreaterThan(30);
    expect(placed[1]!.overflow).toBe(true);
  });
});
