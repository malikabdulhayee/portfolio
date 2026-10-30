/*
 * Audit Me: pure game logic (no DOM). Unit-tested in tests/engine.test.js.
 * Scoring rules match the server-side validation in infra/lambda/app.py.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AuditEngine = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE = 100;          // points for a finding fixed with no wrong picks
  var PENALTY = 25;        // lost per wrong pick
  var FLOOR = 25;          // a fixed finding is never worth less than this
  var TIME_BONUS_START = 120;
  var VERSION = 1;

  function scenarioPoints(wrong) {
    return Math.max(FLOOR, BASE - PENALTY * wrong);
  }

  function timeBonus(seconds) {
    return Math.max(0, TIME_BONUS_START - Math.floor(seconds));
  }

  // Fisher-Yates; `rnd` is injectable so tests are deterministic.
  function shuffle(list, rnd) {
    var a = list.slice();
    var r = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function byId(scenarios, id) {
    for (var i = 0; i < scenarios.length; i++) { if (scenarios[i].id === id) return scenarios[i]; }
    return null;
  }

  function newRun(scenarios, rnd) {
    var queue = [];
    var optionOrder = {};
    scenarios.forEach(function (s) {
      if (!s.bonus) queue.push(s.id);
      var idx = [];
      for (var i = 0; i < s.options.length; i++) idx.push(i);
      optionOrder[s.id] = shuffle(idx, rnd);
    });
    return {
      v: VERSION,
      queue: queue,
      pos: 0,
      view: 'intro',          // intro | play | unlock | report
      results: {},            // id -> { wrong: n, solved: bool, picked: [optionIndex] }
      optionOrder: optionOrder,
      elapsedMs: 0,
      submitted: false
    };
  }

  // A stored run is only trusted if it still matches the current scenarios.
  function isValidRun(run, scenarios) {
    if (!run || run.v !== VERSION || !Array.isArray(run.queue) || !run.results || !run.optionOrder) return false;
    if (typeof run.pos !== 'number' || run.pos < 0 || run.pos >= run.queue.length) return false;
    if (['intro', 'play', 'unlock', 'report'].indexOf(run.view) === -1) return false;
    for (var i = 0; i < run.queue.length; i++) { if (!byId(scenarios, run.queue[i])) return false; }
    for (var k = 0; k < scenarios.length; k++) {
      var o = run.optionOrder[scenarios[k].id];
      if (!Array.isArray(o) || o.length !== scenarios[k].options.length) return false;
    }
    return true;
  }

  function resultFor(run, id) {
    if (!run.results[id]) run.results[id] = { wrong: 0, solved: false, picked: [] };
    return run.results[id];
  }

  // Apply a pick. Returns { correct, wrong, points, hint }.
  function answer(run, scenario, optionIndex) {
    var res = resultFor(run, scenario.id);
    var opt = scenario.options[optionIndex];
    if (!opt || res.solved) return { correct: false, wrong: res.wrong, points: scenarioPoints(res.wrong), hint: '' };
    if (opt.correct) {
      res.solved = true;
      return { correct: true, wrong: res.wrong, points: scenarioPoints(res.wrong), hint: '' };
    }
    if (res.picked.indexOf(optionIndex) === -1) {
      res.picked.push(optionIndex);
      res.wrong += 1;
    }
    return { correct: false, wrong: res.wrong, points: scenarioPoints(res.wrong), hint: opt.hint || '' };
  }

  function totals(run, scenarios, seconds) {
    var base = 0, solved = 0;
    run.queue.forEach(function (id) {
      var r = run.results[id];
      if (r && r.solved) { solved += 1; base += scenarioPoints(r.wrong); }
    });
    var bonus = solved === run.queue.length ? timeBonus(seconds) : 0;
    return { base: base, bonus: bonus, total: base + bonus, solved: solved, count: run.queue.length };
  }

  function currentScenario(run, scenarios) {
    return byId(scenarios, run.queue[run.pos]);
  }

  // Move on after an unlock. `withBonus` appends the bonus finding to the queue.
  function advance(run, scenarios, withBonus) {
    var atEnd = run.pos >= run.queue.length - 1;
    if (atEnd && withBonus) {
      var bonus = scenarios.filter(function (s) { return s.bonus && run.queue.indexOf(s.id) === -1; })[0];
      if (bonus) { run.queue.push(bonus.id); }
    }
    if (run.pos < run.queue.length - 1) {
      run.pos += 1;
      run.view = 'play';
    } else {
      run.view = 'report';
    }
    return run.view;
  }

  function hasBonusLeft(run, scenarios) {
    return scenarios.some(function (s) { return s.bonus && run.queue.indexOf(s.id) === -1; });
  }

  function hasProgress(run) {
    return run.view !== 'intro' || Object.keys(run.results).length > 0;
  }

  function formatTime(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function resultLine(t, seconds) {
    return 'Audit passed in ' + Math.floor(seconds) + ' s, ' + t.total + ' pts';
  }

  // Same rule the server applies; the server also checks a blocked-word list.
  function validNickname(raw) {
    var n = String(raw == null ? '' : raw).trim();
    return /^[A-Za-z0-9 _-]{2,16}$/.test(n);
  }

  return {
    BASE: BASE, PENALTY: PENALTY, FLOOR: FLOOR, TIME_BONUS_START: TIME_BONUS_START, VERSION: VERSION,
    scenarioPoints: scenarioPoints, timeBonus: timeBonus, shuffle: shuffle, byId: byId,
    newRun: newRun, isValidRun: isValidRun, answer: answer, totals: totals,
    currentScenario: currentScenario, advance: advance, hasBonusLeft: hasBonusLeft,
    hasProgress: hasProgress, formatTime: formatTime, resultLine: resultLine, validNickname: validNickname
  };
});
