// Unit tests for the game logic. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../site/js/engine.js');
const SC = require('../site/js/scenarios.js').scenarios;

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('points drop 25 per wrong pick and never below 25', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(E.scenarioPoints), [100, 75, 50, 25, 25, 25]);
});

test('time bonus counts down from 120 and stops at 0', () => {
  assert.equal(E.timeBonus(0), 120);
  assert.equal(E.timeBonus(74.9), 46);
  assert.equal(E.timeBonus(120), 0);
  assert.equal(E.timeBonus(900), 0);
});

test('shuffle keeps every element and is deterministic for a seed', () => {
  const a = E.shuffle([0, 1, 2, 3], seeded(7));
  const b = E.shuffle([0, 1, 2, 3], seeded(7));
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), [0, 1, 2, 3]);
});

test('a new run queues the three core findings and hides the bonus', () => {
  const run = E.newRun(SC, seeded(3));
  assert.deepEqual(run.queue, ['s1', 's2', 's3']);
  assert.ok(E.isValidRun(run, SC));
  assert.ok(E.hasBonusLeft(run, SC));
});

test('wrong picks cost points, repeats are not double counted, correct pick solves', () => {
  const run = E.newRun(SC, seeded(3));
  const s1 = SC[0];
  const wrong = s1.options.findIndex((o) => !o.correct);
  const right = s1.options.findIndex((o) => o.correct);
  let out = E.answer(run, s1, wrong);
  assert.equal(out.correct, false);
  assert.equal(out.points, 75);
  assert.ok(out.hint.length > 10);
  out = E.answer(run, s1, wrong);
  assert.equal(run.results.s1.wrong, 1);
  out = E.answer(run, s1, right);
  assert.equal(out.correct, true);
  assert.equal(out.points, 75);
});

test('full run totals: 3 fixes with one wrong pick, then the time bonus', () => {
  const run = E.newRun(SC, seeded(3));
  SC.slice(0, 3).forEach((s, i) => {
    if (i === 0) E.answer(run, s, s.options.findIndex((o) => !o.correct));
    E.answer(run, s, s.options.findIndex((o) => o.correct));
  });
  const t = E.totals(run, SC, 74);
  assert.deepEqual(t, { base: 275, bonus: 46, total: 321, solved: 3, count: 3 });
  assert.equal(E.resultLine(t, 74), 'Audit passed in 74 s, 321 pts');
});

test('no time bonus until every queued finding is fixed', () => {
  const run = E.newRun(SC, seeded(3));
  E.answer(run, SC[0], SC[0].options.findIndex((o) => o.correct));
  assert.equal(E.totals(run, SC, 10).bonus, 0);
});

test('advance walks the queue, offers the bonus only at the end, then reports', () => {
  const run = E.newRun(SC, seeded(3));
  run.view = 'unlock';
  assert.equal(E.advance(run, SC, false), 'play');
  assert.equal(run.pos, 1);
  E.advance(run, SC, false);
  assert.equal(run.pos, 2);
  assert.equal(E.advance(run, SC, true), 'play');
  assert.deepEqual(run.queue, ['s1', 's2', 's3', 's4']);
  assert.equal(E.hasBonusLeft(run, SC), false);
  assert.equal(E.advance(run, SC, true), 'report');
});

test('stored runs are rejected when they no longer match the scenarios', () => {
  const run = E.newRun(SC, seeded(3));
  assert.ok(E.isValidRun(JSON.parse(JSON.stringify(run)), SC));
  assert.equal(E.isValidRun(null, SC), false);
  assert.equal(E.isValidRun({ v: 99 }, SC), false);
  const stale = JSON.parse(JSON.stringify(run));
  stale.queue = ['gone'];
  assert.equal(E.isValidRun(stale, SC), false);
  const short = JSON.parse(JSON.stringify(run));
  short.optionOrder.s1 = [0];
  assert.equal(E.isValidRun(short, SC), false);
});

test('nickname rules match the server', () => {
  assert.ok(E.validNickname('Umer Ops'));
  assert.ok(E.validNickname('  ab  '));
  assert.ok(!E.validNickname('a'));
  assert.ok(!E.validNickname('<b>x</b>'));
  assert.ok(!E.validNickname('x'.repeat(17)));
  assert.ok(!E.validNickname(null));
});

test('time formatting', () => {
  assert.equal(E.formatTime(0), '00:00');
  assert.equal(E.formatTime(74), '01:14');
  assert.equal(E.formatTime(3599), '59:59');
});

test('every scenario has exactly one correct fix, 4 options and a hint on each wrong one', () => {
  SC.forEach((s) => {
    assert.equal(s.options.filter((o) => o.correct).length, 1, s.id);
    assert.equal(s.options.length, 4, s.id);
    s.options.filter((o) => !o.correct).forEach((o) => assert.ok(o.hint && o.hint.length > 20, s.id + ': ' + o.text));
  });
});
