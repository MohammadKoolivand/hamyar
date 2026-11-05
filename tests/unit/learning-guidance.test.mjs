import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { nextLearningGuidance } from '../../src/features/dashboard/learning-guidance.ts';

test('repeated errors win over developing skills and never claim certainty', () => {
  const result = nextLearningGuidance([
    { title: 'اعداد', status: 'developing', incorrect: 1 },
    { title: 'اتحادها', status: 'needs_practice', incorrect: 3 },
  ], true);
  assert.equal(result.kind, 'review');
  assert.match(result.title, /اتحادها/);
  assert.equal(result.destination, 'student-mistakes');
  assert.match(result.description, /شواهد/);
});
test('missing evidence is not misclassified as weakness', () => {
  const result = nextLearningGuidance([{ title: 'مجموعه‌ها', status: 'insufficient_evidence', incorrect: 0 }], false);
  assert.equal(result.kind, 'check');
  assert.match(result.description, /کافی/);
});
test('empty evidence offers practice without fake metrics', () => {
  const result = nextLearningGuidance([], false);
  assert.equal(result.kind, 'continue');
  assert.equal(result.destination, 'student-practice');
});
test('input order and input array are preserved', () => {
  const skills = [{ title:'ب', status:'developing', incorrect:0 }, { title:'الف', status:'needs_review', incorrect:1 }];
  nextLearningGuidance(skills, true);
  assert.equal(skills[0].title,'ب');
});
