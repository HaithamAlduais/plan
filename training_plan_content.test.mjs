import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./hybrid_training_tracker.html', import.meta.url), 'utf8');

const requiredSnippets = [
  'HYBRID PLAN — Sun/Tue/Thu',
  'Power first: 60–120s rest, all reps fast.',
  'RULE: top reps all sets clean → add weight. Not top → +1 total rep.',
  'Med-ball chest throw / explosive push-up',
  'Pulldown/assisted pull-up',
  'top → +5kg / less assist 5kg',
  'Prep wrists/shoulders/scap/hips/ankles',
  'less band/higher pull',
  'Power: never grind. If speed drops → stop. Fast 2 weeks → harder/+small load.',
  'Pain/ugly reps → stop or regress.',
  'Top clean → add weight. Not top → +1 total rep.',
  'L3: banded muscle-up, explosive high pull, wall HSPU negative, advanced tuck front lever, full L-sit.'
];

for (const snippet of requiredSnippets) {
  assert.ok(html.includes(snippet), `Missing required training-plan snippet: ${snippet}`);
}
