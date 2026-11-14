/* ============================================================
   后会友期 · 人格拼图 —— 页面交互逻辑
   流程：封面 → 开场动画（可跳过）→ 20 题 → 票根人格拼图
   ============================================================ */
(function () {
  'use strict';
  var D = window.HHYQ_DATA;
  var S = window.HHYQ_SCORING;
  var $ = function (sel) { return document.querySelector(sel); };

  var STATIONS = ['第1天', '第3天', '第7天', '第12天', '第18天'];
  var LOADING_TEXTS = [
    '正在回放你们那 18 天……',
    '在观察室里，给每一种动机打分……',
    '把你的选择和同车的人对上号……',
  ];
  var INTRO_LINES = [
    '2026 年，你收到一张没有署名的车票。',
    '终点是张掖。同行的还有三对走散多年的旧友。',
    '还有一个人——你也说不清，还算不算朋友。',
    '接下来 18 天，你不需要和好，只需要诚实。',
    '现在，请把 TA 想成那个你一直没联系的人。',
    '检票上车。',
  ];

  var ENDING = {
    repair: [
      '你们大概率会再联系一次。不是抱头痛哭的和解，而是某天谁先发了一句「在吗」。',
      '你会把这段关系从「算了」拉回「再说说看」——不是回到从前，是重新谈一次条件。',
    ],
    wobble: [
      '你们大概率会卡在「谁先开口」上：想联系，又怕自己显得太在意。',
      '你还在原地，但灯没关。也许差的就是一句「最近怎么样」。',
    ],
    leave: [
      '你们大概率会停在「体面」两个字上。没有撕破脸，也没有再联系。',
      '你会让这段关系在一个不难看的位置结束。告别不是失败——节目里四组旧友，最后也只有一组真正破冰。',
    ],
  };
  var LINES = {
    repair: [
      '「这些年我想过很多次怎么开口。要不，我们从头聊一次？」',
      '「不用马上和好。先告诉我，你那边这些年过得怎么样。」',
    ],
    wobble: [
      '「我最近总想起那趟车。你要是也想，就回我一句。」',
      '「我不知道还算不算朋友，但那 18 天我一直记得。」',
    ],
    leave: [
      '「谢谢你出现过。这次我就不打扰了，真的。」',
      '「我们都没做错什么，只是走到了不同的站台。」',
    ],
  };

  var state = { index: 0, answers: {}, result: null, locked: false, optionSeed: 0 };
  var introTimer = null;
  var introIndex = 0;

  /* ---------------- 工具 ---------------- */
  function show(screenId) {
    document.querySelectorAll('.screen').forEach(function (el) { el.classList.remove('is-active'); });
    var el = document.getElementById(screenId);
    if (el) el.classList.add('is-active');
    window.scrollTo(0, 0);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  function fnName(fn) { return D.functionName[fn] || fn; }

  function stableOrder(q) {
    // 每次作答（每次开始新测试）用一个随机种子；同一次测试里回看题目顺序不变。
    var seedKey = state.optionSeed + '|' + q.id;
    return q.options.slice().sort(function (a, b) {
      var ha = S.answerSeed([{ questionId: seedKey, optionId: a.id }]);
      var hb = S.answerSeed([{ questionId: seedKey, optionId: b.id }]);
      return ha - hb;
    });
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------- 封面 ---------------- */
  function renderCover() {
    var fan = $('#ticketFan');
    fan.innerHTML = '';
    D.characters.forEach(function (c, i) {
      var t = i - 3.5;
      var card = document.createElement('div');
      card.className = 'fan-card';
      card.style.transform = 'translateX(' + (t * 27) + 'px) rotate(' + (t * 7) + 'deg)';
      card.style.zIndex = String(10 - Math.abs(Math.round(t)));
      card.innerHTML =
        '<div class="fan-name">' + escapeHtml(c.name) + '</div>' +
        '<div class="fan-role">' + escapeHtml(c.title) + '</div>';
      card.title = c.name + '｜' + c.title + '｜' + fnName(c.function);
      fan.appendChild(card);
    });
  }

  /* ---------------- 开场动画 ---------------- */
  function showIntro() {
    show('screen-intro');
    var box = $('#introLines');
    box.innerHTML = '';
    introIndex = 0;
    Object.keys(ENDING).forEach(function (k) { /* keep style engine warm */ });
    if (prefersReduced()) {
      INTRO_LINES.forEach(function (line) {
        var p = document.createElement('p');
        p.className = 'intro-line is-visible';
        p.textContent = line;
        box.appendChild(p);
      });
      $('#btnSkipIntro').textContent = '继续';
      clearTimeout(introTimer);
      introTimer = setTimeout(startQuiz, 2600);
      return;
    }
    $('#btnSkipIntro').textContent = '跳过';
    nextIntroLine();
    introTimer = setInterval(function () {
      introIndex += 1;
      if (introIndex >= INTRO_LINES.length) {
        clearInterval(introTimer);
        setTimeout(startQuiz, 1100);
        return;
      }
      nextIntroLine();
    }, 1750);
  }

  function nextIntroLine() {
    var box = $('#introLines');
    var p = document.createElement('p');
    p.className = 'intro-line is-visible';
    p.textContent = INTRO_LINES[introIndex];
    box.appendChild(p);
    setTimeout(function () { p.classList.add('is-soft'); }, 1200);
  }

  function skipIntro() {
    clearInterval(introTimer);
    clearTimeout(introTimer);
    startQuiz();
  }

  /* ---------------- 答题 ---------------- */
  function renderQuizMeta(q) {
    $('#qIndex').textContent = '第 ' + (state.index + 1) + ' / ' + D.questions.length + ' 题';
    $('#qPart').textContent = q.part;
    var pct = ((state.index + 1) / D.questions.length) * 100;
    $('#railFill').style.width = pct + '%';
    $('#trainIcon').style.left = pct + '%';
    var part = (D.parts || []).find(function (p) { return p.name === q.part; });
    $('#partIntro').textContent = part && part.intro ? part.intro : '';
  }

  function renderStations() {
    var box = $('#stations');
    box.innerHTML = '';
    STATIONS.forEach(function (name, i) {
      var span = document.createElement('span');
      span.textContent = name;
      span.style.position = 'absolute';
      span.style.left = (i / (STATIONS.length - 1)) * 100 + '%';
      box.appendChild(span);
    });
  }

  function renderQuestion() {
    var q = D.questions[state.index];
    if (!q) return;
    state.locked = false;
    var hint = $('#choiceHint');
    if (hint) hint.textContent = '';
    renderQuizMeta(q);
    $('#questionText').textContent = q.text;
    var wrap = $('#options');
    wrap.innerHTML = '';
    var opts = stableOrder(q);
    opts.forEach(function (o, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.dataset.optionId = o.id;
      btn.innerHTML =
        '<span class="seat">' + 'ABCD'[idx] + '</span>' +
        '<span class="option-text">' + escapeHtml(o.text) + '</span>';
      btn.addEventListener('click', function () { chooseOption(q, o.id); });
      wrap.appendChild(btn);
    });
    var chosen = state.answers[q.id];
    if (chosen) {
      var found = wrap.querySelector('[data-option-id="' + chosen + '"]');
      if (found) found.classList.add('is-chosen');
    }
    $('#btnBack').disabled = state.index === 0;
    $('#btnBack').style.opacity = state.index === 0 ? 0.45 : 1;
  }

  function chooseOption(q, optionId) {
    // 关键：一题只允许提交一次。点击后先锁住，记录答案并给出确认，再进入下一题。
    if (state.locked) return;
    state.locked = true;
    state.answers[q.id] = optionId;

    var chosenText = '';
    document.querySelectorAll('.option').forEach(function (n) {
      var isChosen = n.dataset.optionId === optionId;
      n.classList.toggle('is-chosen', isChosen);
      if (isChosen) {
        var t = n.querySelector('.option-text');
        chosenText = t ? t.textContent : '';
      }
    });
    var hint = $('#choiceHint');
    if (hint) hint.textContent = '已记录：' + optionId + ' · ' + chosenText;

    setTimeout(function () {
      if (state.index < D.questions.length - 1) {
        state.index += 1;
        renderQuestion();
      } else {
        runLoading();
      }
    }, 380);
  }

  function backQuestion() {
    if (state.locked) return;
    if (state.index > 0) {
      state.index -= 1;
      renderQuestion();
    }
  }

  function startQuiz() {
    clearInterval(introTimer);
    clearTimeout(introTimer);
    if (!state.optionSeed) state.optionSeed = Math.floor(Math.random() * 1000000000) + 1;
    var firstUnanswered = D.questions.findIndex(function (q) { return !state.answers[q.id]; });
    state.index = firstUnanswered === -1 ? 0 : firstUnanswered;
    renderStations();
    renderQuestion();
    show('screen-quiz');
  }

  /* ---------------- 计算中 ---------------- */
  var loadingTimer = null;
  function runLoading() {
    var answered = Object.keys(state.answers).length;
    if (answered < Math.ceil((D.questions.length * 18) / 20)) {
      if (!window.confirm('还有几道题没答，要回去补完吗？（至少答 18 题）')) return;
      startQuiz();
      return;
    }
    show('screen-loading');
    $('#loadingText').textContent = LOADING_TEXTS[0];
    var i = 0;
    clearInterval(loadingTimer);
    loadingTimer = setInterval(function () {
      i += 1;
      $('#loadingText').textContent = LOADING_TEXTS[i % LOADING_TEXTS.length];
    }, 780);
    setTimeout(function () {
      clearInterval(loadingTimer);
      buildResult();
    }, 2400);
  }

  /* ---------------- 结果 ---------------- */
  function buildResult() {
    var result = S.score(state.answers);
    state.result = result;
    renderTicket(result);
    renderVerdict(result);
    renderRelations(result);
    renderEnding(result);
    show('screen-result');
  }

  /* 1. 人格拼图票根 */
  function renderTicket(r) {
    $('#ticketCode').textContent = r.code;
    $('#ticketCombo').textContent = r.combo;
    $('#quoteText').textContent = '「' + r.quote.text + '」';
  }

  /* 2. 判词 */
  function renderVerdict(r) {
    var lines = [
      '你是 <strong>' + escapeHtml(r.combo) + '</strong>。',
      '同一趟车上，你选的是 TA 在「' + escapeHtml(r.quote.scene) + '」那一刻的话——',
      '「' + escapeHtml(r.quote.text) + '」',
      '你像 TA 的地方是：' + escapeHtml(r.person.functionRead),
      '这趟车上，你的关系姿态是「' + escapeHtml(r.posture.label) + '」：' + escapeHtml(r.posture.desc),
      '你在关系里的动机是「' + escapeHtml(r.enneagram.name) + '」，关系身份是「' + escapeHtml(r.identity.name) + '」。',
    ];
    $('#verdict').innerHTML = lines.map(function (l) { return '<p style="margin:0 0 8px">' + l + '</p>'; }).join('');
  }

  /* 3. 人物关系 */
  function renderRelations(r) {
    var boxes = [
      { tag: '你最容易和谁走散', data: r.relations.easiestToDrift },
      { tag: '你最想依赖的人', data: r.relations.easiestToRelyOn },
    ];
    $('#relations').innerHTML = boxes
      .map(function (b) {
        var c = b.data.character;
        return (
          '<div class="relation-card">' +
          '<div class="relation-seat">' + escapeHtml(c.name.slice(0, 1)) + '</div>' +
          '<div class="relation-body">' +
          '<p class="relation-tag">' + escapeHtml(b.tag) + '</p>' +
          '<h4>' + escapeHtml(c.name) + '（' + escapeHtml(fnName(c.function)) + '）</h4>' +
          '<p>' + escapeHtml(c.title + ' · ' + b.data.reason) + '</p>' +
          '<p>' + escapeHtml(c.oneLine) + '</p>' +
          '</div></div>'
        );
      })
      .join('');
  }

  /* 4. 结局预测 & 一句话 */
  function renderEnding(r) {
    var post = r.posture.key;
    var paras = ENDING[post] || ENDING.wobble;
    var lines = LINES[post] || LINES.wobble;
    var idx = S.answerSeed(state.answers) % lines.length;
    $('#ending').innerHTML =
      '<span class="ending-tag ' + post + '">' + escapeHtml(r.posture.label) + '</span>' +
      paras.map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join('') +
      '<p>' + escapeHtml('你的方式是「' + r.identity.oneLine + '」') + '</p>' +
      '<div class="ending-line"><small>给旧友的一句话</small>' + escapeHtml(lines[idx]) + '</div>';
  }

  /* ---------------- 复制 ---------------- */
  function copyResult() {
    if (!state.result) return;
    var r = state.result;
    var text =
      '我的后友期人格拼图是：' + r.combo + '\n' +
      '「' + r.quote.text + '」——' + r.person.name + '，' + r.quote.scene + '\n' +
      '关系姿态：' + r.posture.label + '｜动机：' + r.enneagram.name + ' ' + r.enneagram.dual + '｜关系身份：' + r.identity.name + '\n' +
      '（' + r.code + '）';
    function done() {
      $('#copyHint').textContent = '已复制，去粘贴给那个走散的人吧。';
      setTimeout(function () { $('#copyHint').textContent = ''; }, 2600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { window.prompt('复制失败，请手动复制：', text); }
      document.body.removeChild(ta);
    }
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('#btnStart').addEventListener('click', function () {
      state.answers = {};
      state.index = 0;
      state.result = null;
      state.optionSeed = 0;
      showIntro();
    });
    $('#btnSkipIntro').addEventListener('click', skipIntro);
    $('#btnBack').addEventListener('click', backQuestion);
    $('#btnQuit').addEventListener('click', function () {
      if (window.confirm('这趟车才开到一半，确定下车？进度会保留。')) {
        clearInterval(introTimer);
        show('screen-cover');
      }
    });
    $('#btnRestart').addEventListener('click', function () {
      state.answers = {};
      state.index = 0;
      state.result = null;
      show('screen-cover');
    });
    $('#btnRestartTop').addEventListener('click', function () {
      if (window.confirm('清空当前结果，重新领一张车票？')) {
        state.answers = {};
        state.index = 0;
        state.result = null;
        show('screen-cover');
      }
    });
    $('#btnCopy').addEventListener('click', copyResult);

    document.addEventListener('keydown', function (ev) {
      if (!$('#screen-quiz').classList.contains('is-active')) return;
      var key = ev.key.toUpperCase();
      var idx = 'ABCD'.indexOf(key);
      if (idx >= 0) {
        var q = D.questions[state.index];
        var opts = stableOrder(q);
        if (opts[idx]) chooseOption(q, opts[idx].id);
      } else if (ev.key === 'ArrowLeft') {
        backQuestion();
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  renderCover();
  bind();
  window.HHYQ_VERSION = D.contentVersion;
})();
