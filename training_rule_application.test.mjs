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
  getBaselinePlanTarget,
  hasExerciseInput,
  mapWorkoutLogToExerciseInput,
  getRestSeconds,
  formatTimerTime,
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
  getBaselinePlanTarget,
  hasExerciseInput,
  mapWorkoutLogToExerciseInput,
  getRestSeconds,
  formatTimerTime,
} = context.__trainingRules;

assert.equal(JSON.stringify(parsePerformanceValues('8, 8, 8')), JSON.stringify([8, 8, 8]));

assert.equal(
  getImmediateRuleAction(planData.sun.exercises[1], { weight: '100', reps: '8,8,8', quality: 'clean' }).message,
  'Top clean: next target 105kg x 15 total reps.'
);

assert.equal(
  getImmediateRuleAction(planData.sun.exercises[1], { weight: '100', reps: '8,7,6', quality: 'clean' }).message,
  'Not top: next target 100kg x 22 total clean reps.'
);

const topCleanTarget = getNextPlanTarget(planData.sun.exercises[1], { weight: '100', reps: '8,8,8', quality: 'clean' });
assert.equal(topCleanTarget.weight, '105');
assert.equal(topCleanTarget.reps, '15');

const notTopTarget = getNextPlanTarget(planData.sun.exercises[1], { weight: '100', reps: '8,7,6', quality: 'clean' });
assert.equal(notTopTarget.weight, '100');
assert.equal(notTopTarget.reps, '22');

const customIncrementTarget = getNextPlanTarget(
  planData.sun.exercises[1],
  { weight: '100', reps: '8,8,8', quality: 'clean' },
  { ...getDefaultRules(), lowerIncrementKg: 10 }
);
assert.equal(customIncrementTarget.weight, '110');
assert.equal(customIncrementTarget.reps, '15');

const tweakedWeightTarget = getNextPlanTarget(
  planData.sun.exercises[1],
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
assert.equal(estimateOneRepMax({ weight: '100', reps: '8', rir: '0' }), 133.33);
assert.equal(estimateOneRepMax({ weight: '100', reps: '8' }), 133.33);

const deloadPlan = getProjectedLoadPlan(
  planData.sun.exercises[1],
  4,
  { ...getDefaultRules(), squatAnchor1RM: 140, lowerIncrementKg: 5, deloadEveryWeeks: 4, deloadLoadFactor: 0.9, deloadSetFactor: 0.6 }
);
assert.equal(deloadPlan.deload, true);
assert.equal(deloadPlan.sets, 2);
assert.equal(deloadPlan.percent, 0.79);
assert.equal(deloadPlan.load, '110');

const e1rmPlan = getProjectedLoadPlan(
  planData.sun.exercises[1],
  1,
  { ...getDefaultRules(), squatAnchor1RM: 140 },
  { currentLoad: '100', currentReps: '8', rir: '2' }
);
assert.equal(e1rmPlan.e1rm, '133.33');
assert.equal(e1rmPlan.source, 'exercise e1RM');

const directE1rmPlan = getProjectedLoadPlan(
  planData.sun.exercises[1],
  1,
  { ...getDefaultRules(), squatAnchor1RM: 140 },
  { directE1RM: '160', currentLoad: '100', currentReps: '8', rir: '2' }
);
assert.equal(directE1rmPlan.e1rm, '160');
assert.equal(directE1rmPlan.source, 'direct e1RM');
assert.equal(directE1rmPlan.load, '130');

const baselineTarget = getBaselinePlanTarget(
  planData.sun.exercises[1],
  1,
  { ...getDefaultRules(), squatAnchor1RM: 140 },
  { currentLoad: '100', currentReps: '8', rir: '2' }
);
assert.equal(baselineTarget.weight, '105');
assert.equal(baselineTarget.reps, '15');

const skillPlan = getProjectedSkillPlan('handstand', 5, { ...getDefaultRules(), handstandLevel: 1, skillWeeksPerLevel: 4 });
assert.equal(skillPlan.phase, 'Strength-skill bridge');
assert.equal(skillPlan.level, 2);
assert.equal(skillPlan.drill, 'Wall HSPU eccentric 4x2-4 + freestanding kick-up practice');

const overriddenSkillPlan = getProjectedSkillPlan('handstand', 1, { ...getDefaultRules(), handstandLevel: 1 }, { skillLevel: '3' });
assert.equal(overriddenSkillPlan.level, 3);
assert.equal(overriddenSkillPlan.drill, 'Deficit/wall HSPU or freestanding HSPU quality sets');

assert.equal(hasExerciseInput({ currentLoad: '100' }), true);
assert.equal(hasExerciseInput({ currentLoad: '', currentReps: '', rir: '' }), false);
assert.equal(
  JSON.stringify(mapWorkoutLogToExerciseInput({ weight: '100', reps: '8', rir: '2' }, { directE1RM: '150' })),
  JSON.stringify({ directE1RM: '150', currentLoad: '100', currentReps: '8' })
);
assert.equal(
  JSON.stringify(mapWorkoutLogToExerciseInput({ skillLevel: '3' }, { currentLoad: '100' })),
  JSON.stringify({ currentLoad: '100', skillLevel: '3' })
);

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[0], { reps: 'fast', quality: 'speed-drop' }).message,
  'Speed dropped: stop the power work now. Keep it fast next time.'
);

assert.equal(
  getImmediateRuleAction(planData.thu.exercises[1], { reps: '4,4,4', quality: 'clean' }).message,
  'Top clean: reduce band 1 step or pull higher next time.'
);

assert.equal(
  getImmediateRuleAction(planData.thu.exercises[2], { reps: '30,30,30', quality: 'clean' }).message,
  'Target reached: advance to wall handstand or a harder handstand line drill.'
);

assert.equal(
  getImmediateRuleAction(planData.sun.exercises[3], { reps: '10,10,10', quality: 'pain' }).message,
  'Pain/ugly reps: stop or regress. Use same weight or -5% next time.'
);

assert.equal(getRestSeconds(planData.sun.exercises[0]), 90, 'Power rest should use the middle of 60-120s');
assert.equal(getRestSeconds(planData.sun.exercises[1]), 120, 'Superset/pair work should rest 2 minutes');
assert.equal(getRestSeconds(planData.sun.exercises[6]), 75, 'Accessory work should rest 60-75s');
assert.equal(getRestSeconds(planData.thu.exercises[2]), 60, 'Skill work should use a short quality rest');
assert.equal(getRestSeconds(planData.thu.exercises[0]), 0, 'Prep work should not render a timer');
assert.equal(formatTimerTime(90), '1:30');
assert.equal(formatTimerTime(75), '1:15');

const simpleTabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(simpleTabs, ['sun', 'tue', 'thu'], 'The app should show only the 3 training day panels');
assert.equal(html.includes('rir-input'), false, 'RIR should be automated, not entered manually');
assert.equal(html.includes('rule-input'), false, 'Progress rules should be automated from the simple plan');
assert.equal(html.includes('planner-input'), false, 'Exercise inputs should come from the 3 day panels only');
assert.equal(html.includes('week-input'), false, 'Week planning should be automated, not a separate panel');
assert.equal(html.includes('function renderInfo'), false, 'Removed panels should not keep dead renderers');
assert.equal(html.includes('function renderWeekView'), false, 'Week panel renderer should be removed');
assert.equal(html.includes('function renderInputs'), false, 'Exercise Inputs panel renderer should be removed');
assert.equal(html.includes('function renderRules'), false, 'Rules panel renderer should be removed');

let monthTarget = { weight: '100', reps: '15' };
monthTarget = getNextPlanTarget(planData.sun.exercises[1], { weight: '100', reps: '5,5,5', quality: 'clean' }, getDefaultRules(), monthTarget);
assert.equal(monthTarget.weight, '100', 'Week 1 not-top should keep load');
assert.equal(monthTarget.reps, '16', 'Week 1 not-top should add 1 total rep');
monthTarget = getNextPlanTarget(planData.sun.exercises[1], { weight: '100', reps: '8,8,8', quality: 'clean' }, getDefaultRules(), monthTarget);
assert.equal(monthTarget.weight, '105', 'Week 2 top-clean should add load');
assert.equal(monthTarget.reps, '15', 'Week 2 top-clean should reset bottom reps');
monthTarget = getNextPlanTarget(planData.tue.exercises[0], { reps: 'fast', quality: 'speed-drop' }, getDefaultRules(), { skill: 'higher box' });
assert.equal(monthTarget.skill, 'higher box', 'Week 3 power speed-drop should keep the current target');
monthTarget = getNextPlanTarget(planData.sun.exercises[1], { weight: '105', reps: '5,5,5', quality: 'pain' }, getDefaultRules(), { weight: '105', reps: '15' });
assert.equal(monthTarget.weight, '105', 'Week 4 pain should keep load');
assert.equal(monthTarget.reps, '15', 'Week 4 pain should keep reps');

assert.equal(
  getNextPlanTarget(planData.sun.exercises[8], { reps: '40,40', quality: 'clean' }, getDefaultRules(), {}).skill,
  'harder core variation',
  'Hold target reached should move to harder skill'
);
assert.equal(
  getNextPlanTarget(planData.thu.exercises[2], { reps: '30,30,30', quality: 'clean' }, getDefaultRules(), {}).skill,
  'wall handstand or a harder handstand line drill',
  'Skill target reached should move to harder skill'
);

assert.ok(html.includes('next-action'), 'Cards should render an immediate next-action result');
assert.ok(html.includes('timer-button'), 'Cards should render a rest timer button');
assert.ok(html.includes('data-timer-id'), 'Timer controls should target each exercise');
assert.ok(html.includes('quality-select'), 'Cards should let the user mark quality immediately');
assert.ok(html.includes('getNextPlanTarget'), 'Weighted work should calculate next target weight and reps');
assert.ok(html.includes('getSkillProgressionTarget'), 'Calisthenics work should advance to the next skill target');
assert.ok(html.includes('getProjectedLoadPlan'), 'The tracker should project %1RM loads from anchors and e1RM');
assert.ok(html.includes('skill-level-input'), 'Skill levels should be adjustable from day cards and synced to Exercise Inputs');
