import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(existsSync('index.html'), 'Deployment root needs index.html');

const html = readFileSync('index.html', 'utf8');

assert.ok(html.includes('hybrid_training_tracker.html'), 'Root page should link to the training tracker');
assert.ok(html.includes('code_artifact.html'), 'Root page should link to the daily task schedule');
assert.ok(html.includes('<title>Hybrid Plan</title>'), 'Root page should have the app title');

