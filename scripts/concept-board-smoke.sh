#!/usr/bin/env bash
# Concept-board smoke — POST a test message + GET it back for all 17 modules
# wired into the shared aevion_concept_messages store (src/lib/conceptBoardStore.ts).
# Verifies persistence end-to-end against prod.
#
# Exit code: 0 = all 17 green, 1 = at least one red.
# Usage: bash scripts/concept-board-smoke.sh [BASE_URL]

set -u

BASE="${1:-${BASE:-https://aevion.app/api-backend}}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

node --input-type=module -e "
const BASE = process.env.BASE;
const STAMP = process.env.STAMP;

// [api_path, default_post (idea/rationale/author), customMap?]
const MODULES = [
  ['qpersona',         'canonical'],
  ['mapreality',       'canonical'],
  ['voice-of-earth',   'canonical'],
  ['kids-ai',          'canonical'],
  ['qfusionai',        'canonical'],
  ['qlife',            'canonical'],
  ['qgood',            'canonical'],
  ['psyapp-deps',      'canonical'],
  ['deepsan',          'canonical'],
  ['startupx',         'canonical'],
  ['qcontract',        'canonical'],
  ['shadownet',        'canonical'],
  ['lifebox',          'canonical'],
  ['qnews',            'canonical'],
  ['ztide',            'canonical'],
  ['qchaingov',        'qchaingov'],
  ['veilnetx',         'veilnetx'],
];

const PAYLOADS = {
  canonical: () => ({ idea: 'smoke ' + STAMP, rationale: 'auto-smoke', author: 'ci' }),
  qchaingov: () => ({ topic: 'smoke ' + STAMP, motivation: 'auto-smoke', category: 'test' }),
  veilnetx:  () => ({ useCase: 'smoke ' + STAMP, threatModel: 'auto-smoke' }),
};

const MATCH_KEYS = { canonical: 'idea', qchaingov: 'topic', veilnetx: 'useCase' };

let failed = 0;

async function run() {
  console.log('=== concept-board smoke at ' + STAMP + ' ===');
  console.log('Base: ' + BASE);
  console.log('');
  console.log('module               POST  GET_found  total');
  console.log('---------------------+----+----------+-------');

  for (const [path, kind] of MODULES) {
    const payload = PAYLOADS[kind]();
    const matchKey = MATCH_KEYS[kind];
    const expect = payload[matchKey];

    let postCode = 0, gotItem = false, total = '?';
    try {
      const r1 = await fetch(BASE + '/api/' + path + '/concept/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      postCode = r1.status;
      if (postCode === 201) {
        const r2 = await fetch(BASE + '/api/' + path + '/concept/messages?limit=5');
        const list = await r2.json();
        total = String(list.total ?? '?');
        gotItem = (list.items ?? []).some((i) => i?.payload?.[matchKey] === expect);
      }
    } catch (e) {
      console.error('  ' + path + ' ERR ' + e.message);
    }

    const ok = postCode === 201 && gotItem;
    if (!ok) failed++;
    const mark = ok ? '✅' : '❌';
    console.log('  ' + mark + ' ' + path.padEnd(18) + ' ' + String(postCode).padStart(4) + '  ' + (gotItem ? 'yes' : 'no ').padEnd(10) + ' ' + total);
  }

  console.log('');
  console.log(failed === 0 ? '=== ALL 17 GREEN ===' : '=== ' + failed + ' FAILED ===');
  process.exit(failed === 0 ? 0 : 1);
}
run();
"
