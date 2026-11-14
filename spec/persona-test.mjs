/**
 * v2 人设可达性测试：为 24 个组合各构造一组「一致作答」的答案，
 * 验证计分引擎能精确还原「人物 × 关系姿态 → 版本」。
 * 用法：node spec/persona-test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { content, score, stackOf, enumerateCombinations, FUNCTIONS, ENNEAGRAM_IDS } from './scoring.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const questions = JSON.parse(readFileSync(join(__dirname, 'questions.json'), 'utf8')).questions;
const functionQs = questions.filter((q) => q.type === 'function');
const enneagramQs = questions.filter((q) => q.type === 'enneagram');
const identityQs = questions.filter((q) => q.type === 'identity');

const POSTURE_TARGET = { repair: 5, wobble: 1, leave: -5 };

/** 找一组 identity 作答，使 repair 总分达到目标（精确） */
function identityAnswersForStrict(target) {
  // 先按每题选 +1 / -1，再按需要翻转部分题目
  const picks = identityQs.map((q) => {
    const plus = q.options.filter((o) => o.weights.repair === 1);
    const minus = q.options.filter((o) => o.weights.repair === -1);
    return { plus: plus[0], minus: minus[0] };
  });
  const allPlus = picks.map((p) => p.plus);
  const sumAllPlus = identityQs.length; // 每题 +1
  let flips = (sumAllPlus - target) / 2; // 每翻转一题，-2
  if (!Number.isInteger(flips) || flips < 0 || flips > identityQs.length) return null;
  return identityQs.map((q, i) => {
    const use = flips > 0 ? picks[i].minus : picks[i].plus;
    if (flips > 0) flips -= 1;
    return { questionId: q.id, optionId: use.id };
  });
}

/** 为「某个人物（主导功能持有者）」构造功能偏好作答 */
function functionAnswersForPerson(person) {
  // 选一个 dom = person.function 的类型作为目标
  const targetType = content.mbtiTypes.find((t) => t.dom === person.function);
  const stack = stackOf(targetType);
  const pref = Object.fromEntries(FUNCTIONS.map((f) => [f, 0]));
  pref[stack.dom] = 1;
  pref[stack.aux] = 0.8;
  pref[stack.tertiary] = 0.45;
  pref[stack.inferior] = 0.25;

  return functionQs.map((q) => {
    let best = q.options[0];
    let bestScore = -Infinity;
    for (const o of q.options) {
      const s = Object.entries(o.weights)
        .filter(([k]) => FUNCTIONS.includes(k))
        .reduce((sum, [k, v]) => sum + v * pref[k], 0);
      if (s > bestScore) {
        bestScore = s;
        best = o;
      }
    }
    return { questionId: q.id, optionId: best.id };
  });
}

/** 九型题随便选一个能拿到某个类型的答案即可（不参与组合判定） */
function enneagramAnswersAny() {
  return enneagramQs.map((q) => {
    const byId = Object.fromEntries(q.options.map((o) => [o.id, o]));
    // 选带 e1 权重的选项；没有就选 A
    const withTarget = q.options.find((o) => (o.weights.e1 || 0) > 0);
    return { questionId: q.id, optionId: (withTarget || byId.A).id };
  });
}

const combos = enumerateCombinations();
let pass = 0;
const fails = [];

for (const person of content.characters) {
  for (const posture of ['repair', 'wobble', 'leave']) {
    const target = combos.find((c) => c.person === person.name && c.posture === posture);
    const answers = [
      ...functionAnswersForPerson(person),
      ...enneagramAnswersAny(),
      ...(identityAnswersForStrict(POSTURE_TARGET[posture]) || []),
    ];
    const result = score(answers, questions);
    const okResult =
      result.combo === target.combo &&
      result.code === target.code &&
      result.person.id === person.id &&
      result.posture.key === posture &&
      result.quote.text === target.quote;
    if (okResult) pass += 1;
    else fails.push({ target: `${person.name}/${posture}`, got: `${result.combo} (${result.posture.key})` });
  }
}

console.log(`人设可达性：${pass} / ${combos.length} 个组合可被一致作答精确命中`);
if (fails.length) {
  console.log(`失败 ${fails.length} 个：`);
  fails.forEach((f) => console.log(`  ${f.target} → ${f.got}`));
  process.exitCode = 1;
} else {
  console.log('✅ 24 个组合全部可达：每位人物的 3 个版本都能被测出来');
}
