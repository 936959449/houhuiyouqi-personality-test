/**
 * 后会友期·人格拼图 —— 计分引擎 v2
 *
 * v2 结果结构：
 *   人格拼图 = {人物}「{后置定语}」   例：许飞「画地为牢版」
 *   - 人物 = 主导功能对应人物（8 选 1）
 *   - 版本 = 该人物 3 个「节目时间事件版本」之一，由关系姿态决定：
 *       想修复 / 还没想好 / 想告别（由修复指数三档切分）
 *   - 每个版本配一句该人物本人说过（或写下）的台词
 *   完整底色（16 型 / 九型 / 关系身份 / 八维）仍然保留，在结果页中段展示。
 *
 * 输入：32 道题的回答（questionId -> optionId）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readJson = (f) => JSON.parse(readFileSync(join(__dirname, f), 'utf8'));

const charactersDoc = readJson('characters.json');
const mbtiDoc = readJson('mbti-types.json');
const enneagramDoc = readJson('enneagram.json');
const identitiesDoc = readJson('identities.json');
const versionsDoc = readJson('versions.json');

export const FUNCTIONS = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'];
export const ENNEAGRAM_IDS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'];
export const ACTS = ['lead', 'harmonize', 'follow', 'observe'];
export const POSTURES = ['repair', 'wobble', 'leave'];

export const content = {
  characters: charactersDoc.characters,
  charByFunction: Object.fromEntries(charactersDoc.characters.map((c) => [c.function, c])),
  charById: Object.fromEntries(charactersDoc.characters.map((c) => [c.id, c])),
  mbtiTypes: mbtiDoc.types,
  axisOpposite: mbtiDoc.meta.axisOpposite,
  typeByCode: Object.fromEntries(mbtiDoc.types.map((t) => [t.code, t])),
  enneagram: enneagramDoc.types,
  enneagramById: Object.fromEntries(enneagramDoc.types.map((e) => [e.id, e])),
  triads: enneagramDoc.meta.triads,
  identities: identitiesDoc.identities,
  identityById: Object.fromEntries(identitiesDoc.identities.map((i) => [i.id, i])),
  versions: versionsDoc.versions,
  versionById: Object.fromEntries(versionsDoc.versions.map((v) => [v.id, v])),
  postures: versionsDoc.meta.postures,
  thresholds: versionsDoc.meta.thresholds,
  quoteTypes: versionsDoc.meta.quoteTypes,
};

const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const round = (n) => Math.round(n);

/** FNV-1a：把答案向量压成稳定指纹（同一答案 → 同一指纹 → 同一仲裁结果） */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 答案指纹：与作答顺序无关，只与「题-选项」集合有关 */
export function answerSeed(answers) {
  const list = Array.isArray(answers)
    ? answers
    : Object.entries(answers || {}).map(([questionId, optionId]) => ({ questionId, optionId }));
  return fnv1a(list.map((a) => `${a.questionId}:${a.optionId}`).sort().join('|'));
}

function tieBreakIndex(seed, length) {
  if (length <= 1) return 0;
  return seed % length;
}

/** 一个类型的功能栈：主导 / 辅助 / 第三（辅助的对轴）/ 劣势（主导的对轴） */
export function stackOf(type) {
  const axis = content.axisOpposite;
  return {
    dom: type.dom,
    aux: type.aux,
    tertiary: axis[type.aux],
    inferior: axis[type.dom],
  };
}

/** 答案 → 各维度原始分 */
export function accumulate(answers, questions) {
  const qById = new Map(questions.map((q) => [q.id, q]));
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
      else if (key === 'act') {
        if (acts[value] === undefined) throw new Error(`未知 act: ${value}`);
        acts[value] += 1;
      } else if (key === 'repair') {
        if (value !== 1 && value !== -1) throw new Error(`repair 只能是 ±1: ${value}`);
        repair += value;
        identityAnswers += 1;
        lastRepair = value;
      } else {
        throw new Error(`未知权重键: ${key} (${q.id}/${option.id})`);
      }
    }
  }

  return { functions, enneagram, acts, repair, identityAnswers, answered, lastRepair };
}

function pctMap(raw, keys) {
  const max = Math.max(...keys.map((k) => raw[k]), 0);
  return Object.fromEntries(keys.map((k) => [k, max > 0 ? round((raw[k] / max) * 100) : 0]));
}

/** 16 型排序：功能栈加权得分，确定唯一冠军 */
export function rankTypes(functions, seed = 0) {
  const rows = content.mbtiTypes
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

/** 九型排序 + wing（1 的翼是 2/9；9 的翼是 8/1） */
export function rankEnneagram(enneagram, seed = 0) {
  const sorted = [...content.enneagram].sort(
    (a, b) => enneagram[b.id] - enneagram[a.id] || a.id.localeCompare(b.id),
  );
  const tied = sorted.filter((e) => enneagram[e.id] === enneagram[sorted[0].id]);
  const top = tied[tieBreakIndex(seed, tied.length)];
  const num = Number(top.id.slice(1));
  const lower = num === 1 ? 'e9' : ENNEAGRAM_IDS[num - 2];
  const higher = num === 9 ? 'e1' : ENNEAGRAM_IDS[num];
  const wing = enneagram[lower] >= enneagram[higher] ? lower : higher;
  const wingNum = Number(wing.slice(1));
  return {
    type: top.id,
    name: top.name,
    wing,
    wingNum,
    dual: `${num}w${wingNum}`,
    scores: enneagram,
  };
}

/** 关系行动：4 种行动风格 + 修复/告别去向 */
export function rankIdentity(acts, repair, identityAnswers, lastRepair, seed = 0) {
  const sorted = [...ACTS].sort((a, b) => acts[b] - acts[a] || ACTS.indexOf(a) - ACTS.indexOf(b));
  const tied = sorted.filter((a) => acts[a] === acts[sorted[0]]);
  const act = tied[tieBreakIndex(seed, tied.length)];
  let orientation;
  if (repair > 0) orientation = 'repair';
  else if (repair < 0) orientation = 'leave';
  else orientation = lastRepair > 0 ? 'repair' : 'leave';
  const identity = content.identities.find((i) => i.act === act && i.orientation === orientation);
  const repairIndex =
    identityAnswers > 0 ? round(((repair + identityAnswers) / (2 * identityAnswers)) * 100) : 50;
  return { act, orientation, identity, repairIndex, repairRaw: repair, identityAnswers };
}

/** 修复指数 → 关系姿态（三档） */
export function postureOf(repairIndex, thresholds = content.thresholds) {
  if (repairIndex >= thresholds.repairAbove) return 'repair';
  if (repairIndex <= thresholds.leaveBelow) return 'leave';
  return 'wobble';
}

/**
 * 主入口：回答 → 结果对象
 * @param {Array<{questionId:string, optionId:string}>} answers
 * @param {Array} questions
 */
export function score(answers, questions) {
  const acc = accumulate(answers, questions);
  const seed = answerSeed(answers);

  // —— 完整底色（中段模块展示） ——
  const typeRank = rankTypes(acc.functions, seed);
  const type = content.typeByCode[typeRank[0].code];
  const stack = stackOf(type);
  const person = content.charByFunction[stack.dom];
  const auxCharacter = content.charByFunction[stack.aux];
  const tertiaryCharacter = content.charByFunction[stack.tertiary];
  const inferiorCharacter = content.charByFunction[stack.inferior];

  const enn = rankEnneagram(acc.enneagram, seed);
  const enneagram = content.enneagramById[enn.type];
  const triad = content.triads[enneagram.triad];

  const idn = rankIdentity(acc.acts, acc.repair, acc.identityAnswers, acc.lastRepair, seed);
  const identity = idn.identity;

  // —— v2 人格拼图（唯一组合） ——
  const posture = postureOf(idn.repairIndex);
  const postureMeta = content.postures[posture];
  const version = content.versions.find((v) => v.personId === person.id && v.posture === posture);
  if (!version) throw new Error(`未找到版本：${person.name} / ${posture}`);

  const combo = `${person.name}「${version.suffix}」`;
  const code = `HHYQ-${person.initials}-${version.index}`;

  return {
    combo,
    code,
    person,
    version,
    posture: {
      key: posture,
      label: postureMeta.label,
      desc: postureMeta.desc,
      order: postureMeta.order,
    },
    quote: {
      text: version.quote,
      type: version.quoteType,
      typeLabel: content.quoteTypes[version.quoteType] || version.quoteType,
      scene: version.scene,
      when: version.when,
      note: version.note,
      source: version.source,
    },
    // 完整底色（结果页中段）
    type: {
      code: type.code,
      nickname: type.nickname,
      tagline: type.tagline,
      stack,
      score: typeRank[0].score,
    },
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
        reason: `TA 代表你的劣势功能 ${stack.inferior}——你最不擅长、也最容易忽略的部分。`,
      },
      easiestToRelyOn: {
        character: tertiaryCharacter,
        reason: `TA 代表你的第三功能 ${stack.tertiary}——你不轻易示人、但一用就放松的那一面。`,
      },
    },
    report: {
      functions: pctMap(acc.functions, FUNCTIONS),
      functionsRaw: acc.functions,
      enneagram: pctMap(acc.enneagram, ENNEAGRAM_IDS),
      enneagramRaw: acc.enneagram,
      acts: pctMap(acc.acts, ACTS),
      actsRaw: acc.acts,
      repairIndex: idn.repairIndex,
      repairRaw: idn.repairRaw,
    },
    answered: acc.answered,
  };
}

/** 全量组合枚举：8 位人物 × 每人 3 个版本 = 24 个唯一组合 */
export function enumerateCombinations() {
  const list = [];
  for (const person of content.characters) {
    for (const version of content.versions.filter((v) => v.personId === person.id)) {
      list.push({
        code: `HHYQ-${person.initials}-${version.index}`,
        personId: person.id,
        person: person.name,
        posture: version.posture,
        suffix: version.suffix,
        combo: `${person.name}「${version.suffix}」`,
        quote: version.quote,
        quoteType: version.quoteType,
      });
    }
  }
  return list;
}

export default {
  score,
  accumulate,
  rankTypes,
  rankEnneagram,
  rankIdentity,
  postureOf,
  stackOf,
  enumerateCombinations,
  content,
  FUNCTIONS,
  ENNEAGRAM_IDS,
  ACTS,
  POSTURES,
};
