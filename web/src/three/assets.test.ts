import { describe, expect, it } from 'vitest';
import { normalizePlan } from '@shared/plan';
import { DEMO_PLAN } from '@shared/demoPlan';
import { partBox } from './assets';

describe('demo plan geometry', () => {
  it('sits on the floor and does not interpenetrate', () => {
    const p = normalizePlan(DEMO_PLAN), boxes = p.parts.map(partBox), eps = 0.01;
    expect(Math.abs(Math.min(...boxes.map((b) => b.min.y)))).toBeLessThan(eps);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!.clone().expandByScalar(-eps);
      expect(a.intersectsBox(boxes[j]!), `${p.parts[i]!.id} overlaps ${p.parts[j]!.id}`).toBe(false);
    }
  });
});
