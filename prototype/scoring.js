/**
 * 原型计分引擎 v2（与 spec/scoring.mjs 同一套规则，供浏览器与 Node 双端使用）
 * 注意：原型为了方便离线演示，把权重放在前端；生产实现必须把权重放服务端。
 */
(function (root) {
  const D = root.HHYQ_DATA || (typeof require === 'function' ? require('./data.js') : null);
  if (!D) throw new Error('HHYQ_DATA 未加载');

  const FUNCTIONS = D.functions;
  const ENNEAGRAM_IDS = D.enneagram.map((e) => e.id);
  const ACTS = ['lead', 'harmonize', 'follow', 'observe'];
  const POSTURES = ['repair', 'wobble', 'leave'];

  const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
  const round = (n) => Math.round(n);

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function answerSeed(answers) {
    const list = Array.isArray(answers)
      ? answers
      : Object.entries(answers || {}).map(([questionId, optionId]) => ({ questionId, optionId }));
    return fnv1a(list.map((a) => `${a.questionId}:${a.optionId}`).sort().join('|'));
  }

  function tieBreakIndex(seed, length) {
    if (length <= 1) return 0;
    return seed % length;
  }

  function stackOf(type) {
    const axis = D.axisOpposite;
    return { dom: type.dom, aux: type.aux, tertiary: axis[type.aux], inferior: axis[type.dom] };
  }

  function accumulate(answers) {
    const qById = new Map(D.questions.map((q) => [q.id, q]));
    const functions = zeros(FUNCTIONS);
    const enneagram = zeros(ENNEAGRAM_IDS);
    const acts = zeros(ACTS);
    let repair = 0;
    let identityAnswers = 0;
    let answered = 0;
    let lastRepair = 0;

    const list = Array.isArray(answers)
      ? answers
      : Object.entries(answers || {}).map(([questionId, optionId]) => ({ questionId, optionId }));

    for (const ans of list) {
      const q = qById.get(ans.questionId);
      if (!q) continue;
      const option = q.options.find((o) => o.id === ans.optionId);
      if (!option) continue;
      answered += 1;
      for (const [key, value] of Object.entries(option.weights || {})) {
        if (FUNCTIONS.includes(key)) functions[key] += value;
        else if (ENNEAGRAM_IDS.includes(key)) enneagram[key] += value;
        else if (key === 'act') acts[value] += 1;
        else if (key === 'repair') {
          repair += value;
          identityAnswers += 1;
          lastRepair = value;
        }
      }
    }
    return { functions, enneagram, acts, repair, identityAnswers, answered, lastRepair };
  }

  function rankTypes(functions, seed) {
    const rows = D.types
      .map((type) => {
        const stack = stackOf(type);
        const score =
          1.0 * functions[stack.dom] +
          0.7 * functions[stack.aux] +
          0.35 * functions[stack.tertiary] +
          0.2 * functions[stack.inferior];
        return {
          code: type.code,
          score: round(score * 100) / 100,
          domScore: functions[stack.dom],
          auxScore: functions[stack.aux],
          stack,
        };
      })
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
    const tied = rows.filter(
      (r) => r.score === rows[0].score && r.domScore === rows[0].domScore && r.auxScore === rows[0].auxScore,
    );
    const winner = tied[tieBreakIndex(seed, tied.length)];
    return [winner, ...rows.filter((r) => r !== winner)];
  }

  function rankEnneagram(enneagram, seed) {
    const sorted = D.enneagram
      .slice()
      .sort((a, b) => enneagram[b.id] - enneagram[a.id] || a.id.localeCompare(b.id));
    const tied = sorted.filter((e) => enneagram[e.id] === enneagram[sorted[0].id]);
    const top = tied[tieBreakIndex(seed, tied.length)];
    const num = Number(top.id.slice(1));
    const lower = num === 1 ? 'e9' : ENNEAGRAM_IDS[num - 2];
    const higher = num === 9 ? 'e1' : ENNEAGRAM_IDS[num];
    const wing = enneagram[lower] >= enneagram[higher] ? lower : higher;
    return {
      type: top.id,
      name: top.name,
      wing,
      dual: `${num}w${Number(wing.slice(1))}`,
    };
  }

  function rankIdentity(acts, repair, identityAnswers, lastRepair, seed) {
    const sorted = ACTS.slice().sort((a, b) => acts[b] - acts[a] || ACTS.indexOf(a) - ACTS.indexOf(b));
    const tied = sorted.filter((a) => acts[a] === acts[sorted[0]]);
    const act = tied[tieBreakIndex(seed, tied.length)];
    let orientation;
    if (repair > 0) orientation = 'repair';
    else if (repair < 0) orientation = 'leave';
    else orientation = lastRepair > 0 ? 'repair' : 'leave';
    const identity = D.identities.find((i) => i.act === act && i.orientation === orientation);
    const repairIndex =
      identityAnswers > 0 ? round(((repair + identityAnswers) / (2 * identityAnswers)) * 100) : 50;
    return { act, orientation, identity, repairIndex, repairRaw: repair };
  }

  function pctMap(raw, keys) {
    const max = Math.max.apply(null, keys.map((k) => raw[k]).concat([0]));
    return Object.fromEntries(keys.map((k) => [k, max > 0 ? round((raw[k] / max) * 100) : 0]));
  }

  function postureOf(repairIndex) {
    if (repairIndex >= D.thresholds.repairAbove) return 'repair';
    if (repairIndex <= D.thresholds.leaveBelow) return 'leave';
    return 'wobble';
  }

  function score(answers) {
    const acc = accumulate(answers);
    const seed = answerSeed(answers);

    const typeRank = rankTypes(acc.functions, seed);
    const type = D.typeByCode[typeRank[0].code];
    const stack = stackOf(type);
    const person = D.charByFunction[stack.dom];
    const auxCharacter = D.charByFunction[stack.aux];
    const tertiaryCharacter = D.charByFunction[stack.tertiary];
    const inferiorCharacter = D.charByFunction[stack.inferior];

    const enn = rankEnneagram(acc.enneagram, seed);
    const enneagram = D.enneagramById[enn.type];
    const triad = D.triads[enneagram.triad];

    const idn = rankIdentity(acc.acts, acc.repair, acc.identityAnswers, acc.lastRepair, seed);
    const identity = idn.identity;

    const posture = postureOf(idn.repairIndex);
    const postureMeta = D.postures[posture];
    const version = D.versions.find((v) => v.personId === person.id && v.posture === posture);
    if (!version) throw new Error('未找到版本：' + person.name + ' / ' + posture);

    const combo = person.name + '「' + version.suffix + '」';
    const code = 'HHYQ-' + person.initials + '-' + version.index;

    return {
      combo,
      code,
      person,
      version,
      posture: { key: posture, label: postureMeta.label, desc: postureMeta.desc, order: postureMeta.order },
      quote: {
        text: version.quote,
        type: version.quoteType,
        typeLabel: D.quoteTypes[version.quoteType] || version.quoteType,
        scene: version.scene,
        when: version.when,
        note: version.note,
        source: version.source,
      },
      type: { code: type.code, nickname: type.nickname, tagline: type.tagline, stack },
      auxCharacter,
      tertiaryCharacter,
      inferiorCharacter,
      enneagram: {
        id: enneagram.id,
        name: enneagram.name,
        adjective: enneagram.adjective,
        triad: enneagram.triad,
        triadName: triad.name,
        triadAdjective: triad.adjective,
        dual: enn.dual,
        core: enneagram.core,
        inRelation: enneagram.inRelation,
        estrangement: enneagram.estrangement,
        repair: enneagram.repair,
        gift: enneagram.gift,
        risk: enneagram.risk,
      },
      identity: {
        id: identity.id,
        name: identity.name,
        act: identity.act,
        orientation: identity.orientation,
        oneLine: identity.oneLine,
        onTrip: identity.onTrip,
        highlight: identity.highlight,
        risk: identity.risk,
        advice: identity.advice,
      },
      relations: {
        easiestToDrift: {
          character: inferiorCharacter,
          reason: 'TA 代表你的劣势功能 ' + stack.inferior + '——你最不擅长、也最容易忽略的部分。',
        },
        easiestToRelyOn: {
          character: tertiaryCharacter,
          reason: 'TA 代表你的第三功能 ' + stack.tertiary + '——你不轻易示人、但一用就放松的那一面。',
        },
      },
      report: {
        functions: pctMap(acc.functions, FUNCTIONS),
        enneagram: pctMap(acc.enneagram, ENNEAGRAM_IDS),
        acts: pctMap(acc.acts, ACTS),
        repairIndex: idn.repairIndex,
        repairRaw: idn.repairRaw,
      },
      answered: acc.answered,
    };
  }

  const api = { score, stackOf, answerSeed, accumulate, postureOf, FUNCTIONS, ENNEAGRAM_IDS, ACTS, POSTURES };
  root.HHYQ_SCORING = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
