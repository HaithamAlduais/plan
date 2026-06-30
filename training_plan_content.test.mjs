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
  'pain/ugly reps → stop or regress',
  'skill-level-input'
];

for (const snippet of requiredSnippets) {
  assert.ok(html.includes(snippet), `Missing required training-plan snippet: ${snippet}`);
}
