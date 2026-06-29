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
};`, context);

const { planData, getImmediateRuleAction, parsePerformanceValues } = context.__trainingRules;

assert.equal(JSON.stringify(parsePerformanceValues('8, 8, 8')), JSON.stringify([8, 8, 8]));

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[1], { reps: '8,8,8', quality: 'clean' }).message,
  'Top clean: add +5kg next time.'
);

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[1], { reps: '8,7,6', quality: 'clean' }).message,
  'Not top: add +1 total clean rep next time.'
);

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
  'Target reached: move to a harder level next time.'
);

assert.equal(
  getImmediateRuleAction(planData.tue.exercises[3], { reps: '10,10,10', quality: 'pain' }).message,
  'Pain/ugly reps: stop or regress. Use same weight or -5% next time.'
);

assert.ok(html.includes('next-action'), 'Cards should render an immediate next-action result');
assert.ok(html.includes('quality-select'), 'Cards should let the user mark quality immediately');
