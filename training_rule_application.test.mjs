import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./hybrid_training_tracker.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const script = scripts.find((body) => body.includes('const planData'));
assert.ok(script, 'Expected to find the app script');

const context = {
  document: {
    getElementById() {
      return {
        addEventListener() {},
        innerHTML: '',
      };
    },
    querySelectorAll() {
      return [];
    },
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
  },
  Date,
};

vm.createContext(context);
vm.runInContext(`${script}
globalThis.__trainingRules = {
  planData,
  getImmediateRuleAction,
  parsePerformanceValues,
  getDefaultRules,
  getNextPlanTarget,
  prepareNewDayState,
  getWeekPhase,
  isDeloadWeek,
  estimateOneRepMax,
  getProjectedLoadPlan,
  getProjectedSkillPlan,
};`, context);

const {
  planData,
  getImmediateRuleAction,
  parsePerformanceValues,
  getDefaultRules,
  getNextPlanTarget,
  prepareNewDayState,
  getWeekPhase,
  isDeloadWeek,
  estimateOneRepMax,
  getProjectedLoadPlan,
  getProjectedSkillPlan,
} = context.__trainingRules;

assert.equal(JSON.stringify(parsePerformanceValues('8, 8, 8')), JSON.stringify([8, 8, 8]));

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[1], { weight: '100', reps: '8,8,8', quality: 'clean' }).message,
  'Top clean: next target 105kg x 15 total reps.'
);

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[1], { weight: '100', reps: '8,7,6', quality: 'clean' }).message,
  'Not top: next target 100kg x 22 total clean reps.'
);

const topCleanTarget = getNextPlanTarget(planData.tue.exercises[1], { weight: '100', reps: '8,8,8', quality: 'clean' });
assert.equal(topCleanTarget.weight, '105');
assert.equal(topCleanTarget.reps, '15');

const notTopTarget = getNextPlanTarget(planData.tue.exercises[1], { weight: '100', reps: '8,7,6', quality: 'clean' });
assert.equal(notTopTarget.weight, '100');
assert.equal(notTopTarget.reps, '22');

const customIncrementTarget = getNextPlanTarget(
  planData.tue.exercises[1],
  { weight: '100', reps: '8,8,8', quality: 'clean' },
  { ...getDefaultRules(), lowerIncrementKg: 10 }
);
assert.equal(customIncrementTarget.weight, '110');
assert.equal(customIncrementTarget.reps, '15');

const tweakedWeightTarget = getNextPlanTarget(
  planData.tue.exercises[1],
  { weight: '97.5', reps: '8,8,8', quality: 'clean' },
  { ...getDefaultRules(), lowerIncrementKg: 5 }
);
assert.equal(tweakedWeightTarget.weight, '102.5');
assert.equal(tweakedWeightTarget.reps, '15');

assert.equal(
  JSON.stringify(prepareNewDayState('Mon Jun 29 2026', 'Tue Jun 30 2026', { 'tue-1a': { weight: '100' } }, { 'tue-1a': true })),
  JSON.stringify({ logs: {}, done: {}, changed: true })
);

assert.equal(getWeekPhase(1), 'Foundation');
assert.equal(getWeekPhase(6), 'Strength-skill bridge');
assert.equal(isDeloadWeek(4, { ...getDefaultRules(), deloadEveryWeeks: 4 }), true);
assert.equal(isDeloadWeek(5, { ...getDefaultRules(), deloadEveryWeeks: 4 }), false);
assert.equal(estimateOneRepMax({ weight: '100', reps: '8', rir: '2' }), 133.33);

const deloadPlan = getProjectedLoadPlan(
  planData.tue.exercises[1],
  4,
  { ...getDefaultRules(), squatAnchor1RM: 140, lowerIncrementKg: 5, deloadEveryWeeks: 4, deloadLoadFactor: 0.9, deloadSetFactor: 0.6 }
);
assert.equal(deloadPlan.deload, true);
assert.equal(deloadPlan.sets, 2);
assert.equal(deloadPlan.percent, 0.79);
assert.equal(deloadPlan.load, '110');

const e1rmPlan = getProjectedLoadPlan(
  planData.tue.exercises[1],
  1,
  { ...getDefaultRules(), squatAnchor1RM: 140 },
  { weight: '100', reps: '8', rir: '2' }
);
assert.equal(e1rmPlan.e1rm, '133.33');
assert.equal(e1rmPlan.source, 'logged e1RM');

const skillPlan = getProjectedSkillPlan('handstand', 5, { ...getDefaultRules(), handstandLevel: 1, skillWeeksPerLevel: 4 });
assert.equal(skillPlan.phase, 'Strength-skill bridge');
assert.equal(skillPlan.level, 2);
assert.equal(skillPlan.drill, 'Wall HSPU eccentric 4x2-4 + freestanding kick-up practice');

assert.equal(
  getImmediateRuleAction(planData.thu.exercises[0], { reps: 'fast', quality: 'speed-drop' }).message,
  'Speed dropped: stop the power work now. Keep it fast next time.'
);

assert.equal(
  getImmediateRuleAction(planData.fri.exercises[1], { reps: '4,4,4', quality: 'clean' }).message,
  'Top clean: reduce band 1 step or pull higher next time.'
);

assert.equal(
  getImmediateRuleAction(planData.fri.exercises[2], { reps: '30,30,30', quality: 'clean' }).message,
  'Target reached: advance to wall handstand or a harder handstand line drill.'
);

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[3], { reps: '10,10,10', quality: 'pain' }).message,
  'Pain/ugly reps: stop or regress. Use same weight or -5% next time.'
);

assert.ok(html.includes('next-action'), 'Cards should render an immediate next-action result');
assert.ok(html.includes('quality-select'), 'Cards should let the user mark quality immediately');
assert.ok(html.includes('getNextPlanTarget'), 'Weighted work should calculate next target weight and reps');
assert.ok(html.includes('getSkillProgressionTarget'), 'Calisthenics work should advance to the next skill target');
assert.ok(html.includes('data-tab="rules"'), 'The tracker should include an editable rules page');
assert.ok(html.includes('rule-input'), 'Rules should be editable from the rules page');
assert.ok(html.includes('data-tab="week"'), 'The tracker should include an Excel-style weekly plan view');
assert.ok(html.includes('getProjectedLoadPlan'), 'The tracker should project %1RM loads from anchors and e1RM');
assert.ok(html.includes('rir-input'), 'Cards should capture RIR for e1RM calculations');
