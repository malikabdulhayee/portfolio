/*
 * Audit Me: game UI. Depends on AuditEngine (engine.js) and AUDIT_SCENARIOS.
 * Rules this file keeps:
 *  - Never uses innerHTML, so nothing from the network can inject markup.
 *  - If anything here fails, the rest of the page is unaffected.
 *  - The game needs no network. Only the optional leaderboard calls the API.
 */
(function () {
  'use strict';

  var E = window.AuditEngine;
  var DATA = window.AUDIT_SCENARIOS;
  var CFG = window.AUDIT_CONFIG || {};
  var dlg = document.getElementById('audit');
  if (!E || !DATA || !dlg || typeof dlg.showModal !== 'function') { return; }

  document.documentElement.classList.add('js');

  var SC = DATA.scenarios;
  var KEY = 'auditme.v1';
  var root = document.getElementById('audit-root');
  var elProgress = document.getElementById('audit-progress');
  var elTimer = document.getElementById('audit-timer');
  var elLive = document.getElementById('audit-live');
  var closeBtn = document.getElementById('audit-close');

  var run = null;
  var openedAt = null;
  var tick = null;

  /* ---------- storage (always optional) ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var r = JSON.parse(raw);
      return E.isValidRun(r, SC) ? r : null;
    } catch (e) { return null; }
  }
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(run)); } catch (e) { /* storage blocked */ } }
  function clearSaved() { try { window.localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } }

  /* ---------- tiny DOM helper ---------- */
  function h(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === false || v == null) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function announce(msg) {
    elLive.textContent = '';
    window.setTimeout(function () { elLive.textContent = msg; }, 30);
  }

  /* ---------- clock: runs only while a finding is on screen ---------- */
  function seconds() {
    var ms = run.elapsedMs + (openedAt !== null ? Date.now() - openedAt : 0);
    return Math.floor(ms / 1000);
  }
  function updateTimer() { elTimer.textContent = E.formatTime(seconds()); }
  function startClock() {
    if (openedAt === null) openedAt = Date.now();
    if (!tick) tick = window.setInterval(updateTimer, 1000);
    updateTimer();
  }
  function stopClock() {
    if (openedAt !== null) { run.elapsedMs += Date.now() - openedAt; openedAt = null; }
    if (tick) { window.clearInterval(tick); tick = null; }
    updateTimer();
  }

  /* ---------- case file on the page ---------- */
  var PLACEHOLDER = 'Classified until the audit is done';
  function renderCaseFile(animate) {
    var n = 0;
    SC.forEach(function (sc) {
      var li = document.querySelector('[data-case="' + sc.id + '"]');
      if (!li) return;
      var v = li.querySelector('.cf-value');
      var solved = !!(run.results[sc.id] && run.results[sc.id].solved);
      if (solved) n += 1;
      if (solved && v.classList.contains('is-redacted')) {
        v.classList.remove('is-redacted');
        v.textContent = sc.casefile.value;
        if (animate) v.classList.add('is-declassified');
      } else if (!solved && !v.classList.contains('is-redacted')) {
        v.classList.remove('is-declassified');
        v.classList.add('is-redacted');
        v.textContent = PLACEHOLDER;
      }
    });
    var c = document.getElementById('casefile-count');
    if (c) c.textContent = n + ' of ' + SC.length + ' declassified';
  }

  /* ---------- header ---------- */
  function updateHeader() {
    var label = '';
    if (run.view === 'play' || run.view === 'unlock') label = 'Finding ' + (run.pos + 1) + ' of ' + run.queue.length;
    else if (run.view === 'report') label = 'Report';
    elProgress.textContent = label;
    updateTimer();
  }

  /* ---------- navigation helpers ---------- */
  function goTo(target) {
    dlg.close();
    window.setTimeout(function () {
      var el = document.querySelector(target);
      if (!el) return;
      el.setAttribute('tabindex', '-1');
      el.scrollIntoView();
      el.focus({ preventScroll: true });
      try { window.history.replaceState(null, '', target); } catch (e) { /* ignore */ }
    }, 0);
  }

  function focusTitle() {
    var t = root.querySelector('[data-focus]');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    root.scrollTop = 0;
  }

  /* ---------- views ---------- */
  function viewIntro() {
    root.replaceChildren(
      h('h3', { class: 'view-title', 'data-focus': '', text: 'Three misconfigurations are hiding my story.' }),
      h('p', { class: 'lead', text: 'This is a simulated cloud account. Fix each finding and a piece of my case file is declassified on the page.' }),
      h('ul', { class: 'rules' }, [
        h('li', { text: 'Pick the fix that removes the risk, not one that only hides it.' }),
        h('li', { text: 'A wrong pick costs 25 points and shows a hint. You can keep trying.' }),
        h('li', { text: 'Faster audits earn a time bonus. The clock only runs while a finding is on screen.' }),
        h('li', { text: 'Press Esc to close. Your progress is saved on this device.' })
      ]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { run.view = 'play'; save(); render(); } }, ['Start the audit'])
      ])
    );
  }

  function resourceCard(sc) {
    return h('div', { class: 'res' }, [
      h('div', { class: 'res-head' }, [
        h('span', { text: sc.resource.kind }),
        h('span', { class: 'sev sev-' + sc.severity.toLowerCase(), text: sc.severity })
      ]),
      h('p', { class: 'res-name', text: sc.resource.name }),
      h('ul', { class: 'res-rows', 'aria-label': 'Resource settings' }, sc.resource.rows.map(function (r) {
        return h('li', { class: r.bad ? 'is-bad' : '' }, [
          h('span', { class: 'k', text: r.k }),
          h('span', { class: 'v' }, [r.v, r.bad ? h('span', { class: 'flag', text: 'exposed' }) : null])
        ]);
      }))
    ]);
  }

  function viewPlay() {
    var sc = E.currentScenario(run, SC);
    var res = run.results[sc.id] || { wrong: 0, picked: [] };
    var order = run.optionOrder[sc.id];

    var worth = h('p', { class: 'worth', id: 'worth', text: 'Worth ' + E.scenarioPoints(res.wrong) + ' points' });
    var feedback = h('div', { class: 'feedback', id: 'feedback' }, [
      'Choose a fix. Keys 1 to ' + order.length + ' also work.'
    ]);

    var list = h('ul', { class: 'opts' });
    order.forEach(function (optIdx, i) {
      var opt = sc.options[optIdx];
      var wasWrong = res.picked.indexOf(optIdx) !== -1;
      var btn = h('button', {
        type: 'button',
        class: 'opt' + (wasWrong ? ' is-wrong' : ''),
        'data-pos': String(i),
        disabled: wasWrong,
        onclick: function () { onPick(sc, optIdx, btn); }
      }, [
        h('span', { class: 'opt-key', 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { class: 'opt-text' }, [opt.text, wasWrong ? h('span', { class: 'opt-note', text: 'Not this one' }) : null])
      ]);
      list.appendChild(h('li', null, [btn]));
    });

    root.replaceChildren(
      h('h3', { class: 'view-title', 'data-focus': '', text: 'Finding ' + (run.pos + 1) + ': ' + sc.resource.kind }),
      h('div', { class: 'play' }, [
        resourceCard(sc),
        h('div', null, [h('p', { class: 'prompt', text: sc.prompt }), worth, list, feedback])
      ])
    );
  }

  function onPick(sc, optIdx, btn) {
    var out = E.answer(run, sc, optIdx);
    save();
    if (out.correct) {
      run.view = 'unlock';
      save();
      announce('Correct. Finding fixed.');
      render(true);
      return;
    }
    btn.disabled = true;
    btn.classList.add('is-wrong');
    btn.querySelector('.opt-text').appendChild(h('span', { class: 'opt-note', text: 'Not this one' }));
    var fb = document.getElementById('feedback');
    fb.className = 'feedback is-bad';
    fb.replaceChildren(h('strong', { text: 'Not quite. ' }), out.hint + ' (-' + E.PENALTY + ' points)');
    document.getElementById('worth').textContent = 'Worth ' + out.points + ' points';
    announce('Not quite. ' + out.hint);
    var next = root.querySelector('.opt:not(:disabled)');
    if (next) next.focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest' });
  }

  function viewUnlock() {
    var sc = E.currentScenario(run, SC);
    var res = run.results[sc.id];
    var last = run.pos >= run.queue.length - 1;
    var bonusLeft = last && E.hasBonusLeft(run, SC);
    var actions = [
      h('button', {
        type: 'button', class: 'btn btn-primary',
        onclick: function () { E.advance(run, SC, false); save(); render(); }
      }, [last ? 'See the audit report' : 'Next finding'])
    ];
    if (bonusLeft) {
      actions.push(h('button', {
        type: 'button', class: 'btn',
        onclick: function () { E.advance(run, SC, true); save(); render(); }
      }, ['Try the bonus finding']));
    }
    actions.push(h('button', { type: 'button', class: 'btn', onclick: function () { goTo(sc.unlock.target); } }, [sc.unlock.targetLabel]));

    root.replaceChildren(
      h('div', { class: 'unlock-wrap' }, [
        h('h3', { class: 'view-title', 'data-focus': '' }, [h('span', { class: 'tick', 'aria-hidden': 'true', text: '✓ ' }), 'Fixed: ' + sc.fixLabel]),
        h('p', { class: 'lead', text: sc.why }),
        h('div', { class: 'card-unlock' }, [
          h('h4', { text: 'Unlocked: ' + sc.unlock.title }),
          h('p', { text: sc.unlock.body })
        ]),
        h('p', { class: 'worth', text: E.scenarioPoints(res.wrong) + ' points for this finding. "' + sc.casefile.label + '" is now declassified in the case file on the page.' }),
        h('div', { class: 'actions' }, actions)
      ])
    );
  }

  /* ---------- report, share, leaderboard ---------- */
  function viewReport() {
    var secs = Math.floor(run.elapsedMs / 1000);
    var t = E.totals(run, SC, secs);
    var wrongTotal = 0;
    run.queue.forEach(function (id) { wrongTotal += (run.results[id] ? run.results[id].wrong : 0); });

    var rows = run.queue.map(function (id) {
      var sc = E.byId(SC, id);
      var r = run.results[id] || { wrong: 0 };
      return h('tr', null, [
        h('td', { class: 'sev-cell sev-' + sc.severity.toLowerCase(), 'data-label': 'Severity', text: sc.severity }),
        h('td', { 'data-label': 'Resource', text: sc.resource.kind + ' ' + sc.resource.name }),
        h('td', { 'data-label': 'Fix applied', text: sc.fixLabel }),
        h('td', { 'data-label': 'Wrong picks', text: String(r.wrong) }),
        h('td', { 'data-label': 'Evidence unlocked', text: sc.unlock.title })
      ]);
    });

    var msg = h('p', { class: 'lb-msg', role: 'status' });
    var kids = [
      h('h3', { class: 'view-title', 'data-focus': '', text: 'Audit passed' }),
      h('p', { class: 'lead', text: 'You fixed ' + t.solved + ' findings in ' + E.formatTime(secs) + '. The case file on the page is now open.' }),
      h('div', { class: 'stats' }, [
        h('div', { class: 'stat' }, [h('b', { text: String(t.total) }), h('span', { text: t.base + ' for fixes + ' + t.bonus + ' time bonus' })]),
        h('div', { class: 'stat' }, [h('b', { text: E.formatTime(secs) }), h('span', { text: 'Time on findings' })]),
        h('div', { class: 'stat' }, [h('b', { text: String(wrongTotal) }), h('span', { text: 'Wrong picks' })])
      ]),
      h('table', { class: 'findings' }, [
        h('caption', { text: 'Audit report' }),
        h('thead', null, [h('tr', null, ['Severity', 'Resource', 'Fix applied', 'Wrong picks', 'Evidence unlocked'].map(function (c) { return h('th', { scope: 'col', text: c }); }))]),
        h('tbody', null, rows)
      ]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { goTo('#about'); } }, ['Open my case file']),
        h('button', { type: 'button', class: 'btn', onclick: function () { copyResult(t, secs, msg); } }, ['Copy result']),
        h('button', { type: 'button', class: 'btn', onclick: playAgain }, ['Play again'])
      ]),
      msg
    ];
    if (CFG.apiUrl) kids.push(boardSection(t, secs));
    root.replaceChildren.apply(root, kids);
  }

  function copyResult(t, secs, msg) {
    var text = E.resultLine(t, secs) + '. Can you beat it? ' + window.location.href.split('#')[0];
    function fallback() {
      var ta = h('textarea', { 'aria-hidden': 'true', readonly: '' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      msg.textContent = ok ? 'Copied.' : 'Copy failed. Select this text instead: ' + text;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { msg.textContent = 'Copied.'; }, fallback);
    } else { fallback(); }
  }

  function playAgain() {
    stopClock();
    run = E.newRun(SC);
    save();
    renderCaseFile(false);
    render();
  }

  function api(path, opts) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    var o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    var url = String(CFG.apiUrl).replace(/\/+$/, '') + path;
    return window.fetch(url, o).then(function (r) {
      window.clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; });
    }, function (err) { window.clearTimeout(timer); throw err; });
  }

  function boardSection(t, secs) {
    var msg = h('p', { class: 'lb-msg', role: 'status' });
    var list = h('ol', { class: 'board', 'aria-label': 'Top scores' });
    var wrap = h('div', { class: 'board-wrap' }, [h('h4', { text: 'Leaderboard' })]);

    function showBoard() {
      api('/leaderboard').then(function (r) {
        if (r.status !== 200 || !r.body || !Array.isArray(r.body.entries)) throw new Error('bad response');
        list.replaceChildren.apply(list, r.body.entries.slice(0, 10).map(function (e, i) {
          return h('li', null, [
            h('span', { class: 'rank', text: String(i + 1) }),
            h('span', { class: 'nick', text: String(e.nickname) }),
            h('span', { class: 'pts', text: e.score + ' pts' }),
            h('span', { class: 'secs', text: e.seconds + ' s' })
          ]);
        }));
        if (!r.body.entries.length) msg.textContent = 'No scores yet. Be the first.';
      }).catch(function () { msg.textContent = 'Leaderboard offline. Your audit still counts.'; });
    }

    if (run.submitted) {
      msg.textContent = 'Your score is on the board.';
    } else {
      var input = h('input', { type: 'text', id: 'lb-nick', maxlength: '16', autocomplete: 'off', placeholder: 'ops-hero' });
      var btn = h('button', { type: 'submit', class: 'btn btn-primary' }, ['Post my score']);
      var form = h('form', { class: 'lb-form', novalidate: '' }, [
        h('div', null, [h('label', { for: 'lb-nick', text: 'Nickname (2 to 16 letters, numbers, spaces, - or _)' }), input]),
        btn
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var nick = input.value.trim();
        if (!E.validNickname(nick)) { msg.textContent = 'Use 2 to 16 letters, numbers, spaces, - or _.'; input.focus(); return; }
        btn.disabled = true;
        msg.textContent = 'Posting…';
        api('/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: nick, score: t.total, seconds: secs, scenarios: t.count })
        }).then(function (r) {
          if (r.status === 201) {
            run.submitted = true; save();
            form.remove();
            msg.textContent = 'Saved. You are on the board.';
            showBoard();
          } else if (r.status === 400) {
            msg.textContent = (r.body && r.body.error) || 'That entry was not accepted.';
            btn.disabled = false;
          } else if (r.status === 429) {
            msg.textContent = 'Too many tries. Wait a minute and post again.';
            btn.disabled = false;
          } else { throw new Error('status ' + r.status); }
        }).catch(function () { msg.textContent = 'Leaderboard offline. Your audit still counts.'; btn.disabled = false; });
      });
      wrap.appendChild(form);
    }
    wrap.appendChild(msg);
    wrap.appendChild(list);
    showBoard();
    return wrap;
  }

  function viewError() {
    root.replaceChildren(
      h('div', { class: 'error-box' }, [
        h('h3', { class: 'view-title', 'data-focus': '', text: 'The audit hit a problem.' }),
        h('p', { class: 'lead', text: 'The rest of the site still works. Reload the game to start again.' }),
        h('div', { class: 'actions' }, [
          h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { clearSaved(); run = E.newRun(SC); render(); } }, ['Reload the game'])
        ])
      ])
    );
  }

  /* ---------- render loop ---------- */
  function render(animateCase) {
    try {
      if (run.view === 'play' && dlg.open) startClock(); else stopClock();
      if (run.view === 'intro') viewIntro();
      else if (run.view === 'play') viewPlay();
      else if (run.view === 'unlock') viewUnlock();
      else viewReport();
      updateHeader();
      renderCaseFile(!!animateCase);
      focusTitle();
    } catch (err) {
      try { viewError(); focusTitle(); } catch (e2) { /* nothing more to do */ }
    }
  }

  /* ---------- wiring ---------- */
  function openAudit() {
    if (dlg.open) return;
    dlg.showModal();
    render();
  }

  run = load() || E.newRun(SC);
  renderCaseFile(false);

  Array.prototype.forEach.call(document.querySelectorAll('[data-open-audit]'), function (b) {
    b.addEventListener('click', openAudit);
  });
  closeBtn.addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('close', function () { stopClock(); save(); });
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', function (ev) {
    if (run.view !== 'play' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var n = parseInt(ev.key, 10);
    if (n >= 1 && n <= 9) {
      var b = root.querySelector('.opt[data-pos="' + (n - 1) + '"]');
      if (b && !b.disabled) { ev.preventDefault(); b.click(); }
    }
  });
  window.addEventListener('pagehide', function () { if (dlg.open) { stopClock(); save(); } });

  if (window.location.hash === '#audit') { openAudit(); }
})();
