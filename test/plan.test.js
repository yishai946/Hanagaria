import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, totals, stepParts, packSheet } from '../src/plan.js';
import { partBox } from '../src/threeAssets.js';
import { DEMO_PLAN } from '../src/demoPlan.js';

test('demo plan normalizes and groups identical parts', () => {
  const p = normalizePlan(DEMO_PLAN);
  assert.equal(p.parts.length, DEMO_PLAN.parts.length);
  assert.deepEqual(p.groups.map((g) => [g.name, g.ids.length]), [['לוח משטח', 6], ['קורה ארוכה', 4], ['שלב מדף', 7], ['קורה קצרה', 4], ['רגל', 4]]);
  assert.equal(p.groups[0].letter, 'א');
  assert.equal(totals(p).materials, 165 + 60 + 84 + 56 + 25 + 40 + 30 + 96 + 69 + 15);
  assert.deepEqual(stepParts(p, 1).map((x) => x.qty).sort(), [4, 4]);
});

test('garbage from the AI never crashes and is clamped', () => {
  const p = normalizePlan({ parts: [{ shape: 'box', size: [1, -2, 3] }, { shape: 'cylinder', step: 99, position: 'x' }, null], steps: [{}], shopping: [{ qty: 'a', unitPrice: -5, url: 'javascript:alert(1)' }] });
  assert.equal(p.parts.length, 1); // invalid box dropped
  assert.equal(p.parts[0].step, 0);
  assert.deepEqual(p.parts[0].position, [0, 0, 0]);
  assert.equal(p.shopping[0].url, '');
  assert.equal(totals(p).materials, 0);
  assert.equal(normalizePlan(undefined).steps.length, 1);
});

test('demo parts sit on the floor and do not interpenetrate', () => {
  const p = normalizePlan(DEMO_PLAN), boxes = p.parts.map(partBox), eps = 0.01;
  assert.ok(Math.abs(Math.min(...boxes.map((b) => b.min.y))) < eps);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].clone().expandByScalar(-eps), b = boxes[j];
    assert.ok(!a.intersectsBox(b), `${p.parts[i].id} overlaps ${p.parts[j].id}`);
  }
});

test('sheet packing wraps rows and flags overflow', () => {
  const placed = packSheet({ stockLength: 100, stockWidth: 50, cuts: [{ name: 'a', length: 60, width: 30 }, { name: 'b', length: 60, width: 30 }] });
  assert.equal(placed[1].x, 0);
  assert.ok(placed[1].y > 30);
  assert.equal(placed[1].overflow, true);
});

test('stores keep only http links; old difficulty name maps to new', () => {
  const p = normalizePlan({ difficulty: 'מתקדם', stores: [{ name: 'ACE', url: 'javascript:x', cutService: 1 }, { url: 'https://a.co' }], simplifications: ['פחות חיבורים', 5] });
  assert.equal(p.difficulty, 'קשה');
  assert.deepEqual(p.stores.map((s) => [s.name, s.url, s.cutService]), [['ACE', '', true]]);
  assert.deepEqual(p.simplifications, ['פחות חיבורים']);
});
