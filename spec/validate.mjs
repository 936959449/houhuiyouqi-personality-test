/**
 * v2 内容与算法校验：唯一组合（24）、版本覆盖、题库配平、模拟分布、阈值校准提示
 * 用法：node spec/validate.mjs [--simulate=200000]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { content, score, enumerateCombinations, FUNCTIONS, ENNEAGRAM_IDS, ACTS, POSTURES } from './scoring.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const questionsPath = join(__dirname, 'questions.json');
const hasQuestions = existsSync(questionsPath);
const questions = hasQuestions ? JSON.parse(readFileSync(questionsPath, 'utf8')).questions : [];

const failures = [];
const warns = [];
const ok = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { failures.push(msg); console.log(`  ❌ ${msg}`); };
const warn = (msg) => { warns.push(msg); console.log(`  ⚠️  ${msg}`); };

console.log('\n=== 1. 人物 / 功能映射完整性 ===');
{
  const fns = content.characters.map((c) => c.function).sort();
  if (fns.length === 8 && new Set(fns).size === 8 && FUNCTIONS.every((f) => fns.includes(f))) {
    ok('8位人物 ↔ 8个荣格功能一一对应');
  } else fail(`功能映射异常: ${JSON.stringify(fns)}`);

  const badTypes = content.mbtiTypes.filter(
    (t) => content.charByFunction[t.dom]?.id !== t.main || content.charByFunction[t.aux]?.id !== t.assist,
  );
  if (badTypes.length === 0) ok('16型的 主人物/副人物 与功能映射一致');
  else fail(`类型-人物不一致: ${badTypes.map((t) => t.code).join(',')}`);
}

console.log('\n=== 2. v2 唯一组合空间（人物 × 版本） ===');
{
  const combos = enumerateCombinations();
  const expected = content.characters.length * 3;
  if (combos.length === expected) ok(`组合总数 = 8人 × 每人3版本 = ${combos.length}`);
  else fail(`组合总数异常: ${combos.length} ≠ ${expected}`);

  const uniq = new Set(combos.map((c) => c.combo));
  if (uniq.size === combos.length) ok(`组合名互不重复：${uniq.size}/${combos.length} 唯一`);
  else fail(`组合名重复：${combos.length - uniq.size} 个冲突`);

  const names = content.characters.map((c) => c.name);
  if (combos.every((c) => names.some((n) => c.combo.includes(n)))) ok('全部组合均包含「后会友期」人物');
  else fail('存在不含人物的组合');

  const suffixSet = new Set(combos.map((c) => c.suffix));
  if (suffixSet.size === combos.length) ok('24 个后置定语互不重复（每人 3 个专属版本）');
  else warn(`后置定语有重复：${combos.length - suffixSet.size} 个`);

  // 每人 3 个版本、且三种关系姿态各一
  let postureBad = 0;
  for (const person of content.characters) {
    const vs = content.versions.filter((v) => v.personId === person.id);
    if (vs.length !== 3) { postureBad += 1; continue; }
    if (new Set(vs.map((v) => v.posture)).size !== 3) postureBad += 1;
  }
  if (postureBad === 0) ok('每人 3 个版本、且 想修复 / 还没想好 / 想告别 各一个');
  else fail(`${postureBad} 位人物的版本或姿态不完整`);

  const quoteBad = combos.filter((c) => !c.quote || c.quote.length < 2);
  if (quoteBad.length === 0) ok('24 个组合全部配了台词');
  else fail(`${quoteBad.length} 个组合缺台词`);

  const typeBad = content.versions.filter((v) => !content.quoteTypes[v.quoteType]);
  if (typeBad.length === 0) ok('台词来源类型均合法（原话/转述/书面/原话·节目外）');
  else fail(`非法台词来源类型: ${typeBad.map((v) => v.id).join(',')}`);
}

console.log('\n=== 3. 题库配平（权重未改） ===');
if (!hasQuestions) {
  warn('spec/questions.json 不存在，跳过题库配平与模拟');
} else {
  const byType = { function: [], enneagram: [], identity: [] };
  for (const q of questions) byType[q.type]?.push(q);
  if (questions.length === 32) ok('总题量 32');
  else fail(`题量 ${questions.length} ≠ 32`);

  const parts = [...new Set(questions.map((q) => q.part))];
  if (parts.length === 5) ok(`五个部分：${parts.join(' / ')}`);
  else warn(`部分数量为 ${parts.length}（预期 5）`);

  const fnPrimary = Object.fromEntries(FUNCTIONS.map((f) => [f, 0]));
  const ennPrimary = Object.fromEntries(ENNEAGRAM_IDS.map((e) => [e, 0]));
  const actCount = Object.fromEntries(ACTS.map((a) => [a, 0]));
  let repairPlus = 0;
  let repairMinus = 0;

  for (const q of questions) {
    if (!q.options || q.options.length !== 4) fail(`${q.id} 选项数不是4`);
    for (const o of q.options) {
      const w = o.weights || {};
      if (q.type === 'function') {
        for (const [k, v] of Object.entries(w)) {
          if (!FUNCTIONS.includes(k)) fail(`${q.id}/${o.id} 非法功能键 ${k}`);
          else if (v === 1) fnPrimary[k] += 1;
          else if (v !== 0.5) fail(`${q.id}/${o.id} 功能权重异常 ${k}=${v}`);
        }
      } else if (q.type === 'enneagram') {
        for (const [k, v] of Object.entries(w)) {
          if (!ENNEAGRAM_IDS.includes(k)) fail(`${q.id}/${o.id} 非法九型键 ${k}`);
          else if (v === 1) ennPrimary[k] += 1;
          else if (v !== 0.5) fail(`${q.id}/${o.id} 九型权重异常 ${k}=${v}`);
        }
      } else if (q.type === 'identity') {
        if (!ACTS.includes(w.act)) fail(`${q.id}/${o.id} act 非法: ${w.act}`);
        else actCount[w.act] += 1;
        if (w.repair === 1) repairPlus += 1;
        else if (w.repair === -1) repairMinus += 1;
        else fail(`${q.id}/${o.id} repair 权重非法: ${w.repair}`);
      }
    }
  }

  const fnBad = FUNCTIONS.filter((f) => fnPrimary[f] !== 8);
  if (fnBad.length === 0) ok('八维主权重：每个功能各8次');
  else fail(`八维主权重不配平: ${fnBad.map((f) => `${f}=${fnPrimary[f]}`).join(', ')}`);

  const ennBad = ENNEAGRAM_IDS.filter((e) => ennPrimary[e] !== 4);
  if (ennBad.length === 0) ok('九型主权重：每个类型各4次');
  else fail(`九型主权重不配平: ${ennBad.map((e) => `${e}=${ennPrimary[e]}`).join(', ')}`);

  const actBad = ACTS.filter((a) => actCount[a] !== 7);
  if (actBad.length === 0) ok('关系行动：4种行动风格各7次');
  else fail(`行动风格不配平: ${actBad.map((a) => `${a}=${actCount[a]}`).join(', ')}`);

  if (repairPlus === 14 && repairMinus === 14) ok('修复/告别：+1 与 -1 各14次');
  else fail(`修复/告别不配平: +1=${repairPlus}, -1=${repairMinus}`);
}

console.log('\n=== 4. 模拟分布 & 关系姿态阈值校准 ===');
if (hasQuestions) {
  const simArg = process.argv.find((a) => a.startsWith('--simulate='));
  const N = simArg ? Number(simArg.split('=')[1]) : 100000;
  const personCount = Object.fromEntries(content.characters.map((c) => [c.name, 0]));
  const postureCount = Object.fromEntries(POSTURES.map((p) => [p, 0]));
  const comboSeen = new Set();
  const repairIndexList = [];
  let badWing = 0;

  for (let i = 0; i < N; i += 1) {
    const answers = questions.map((q) => ({
      questionId: q.id,
      optionId: q.options[Math.floor(Math.random() * 4)].id,
    }));
    const r = score(answers, questions);
    personCount[r.person.name] += 1;
    postureCount[r.posture.key] += 1;
    comboSeen.add(r.combo);
    repairIndexList.push(r.report.repairIndex);
    const typeNum = Number(r.enneagram.id.slice(1));
    const wingNum = Number(r.enneagram.dual.split('w')[1]);
    const gap = Math.min(Math.abs(typeNum - wingNum), 9 - Math.abs(typeNum - wingNum));
    if (gap !== 1) badWing += 1;
  }

  if (badWing === 0) ok('九型翼全部合法（相邻型，含 1↔9 环绕）');
  else fail(`九型翼非法 ${badWing} 次`);

  const dist = (obj) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${((v / N) * 100).toFixed(1)}%`);
  console.log(`  人物分布(8): ${dist(personCount).join('  ')}`);
  console.log(`  姿态分布(3): ${dist(postureCount).join('  ')}`);
  console.log(`  模拟命中组合数: ${comboSeen.size} / ${enumerateCombinations().length}`);

  const posts = Object.values(postureCount).map((v) => (v / N) * 100);
  const maxPost = Math.max(...posts);
  if (maxPost > 60) warn(`某关系姿态占比 ${maxPost.toFixed(1)}%，建议调整 versions.json thresholds`);
  else ok(`关系姿态分布可接受（最高 ${maxPost.toFixed(1)}%——中间态"还没想好"天然人数最多）`);

  repairIndexList.sort((a, b) => a - b);
  const q = (p) => repairIndexList[Math.min(repairIndexList.length - 1, Math.floor((p / 100) * repairIndexList.length))];
  console.log(`  修复指数分位：P33=${q(33)}  P50=${q(50)}  P67=${q(67)}  （当前阈值 repairAbove=${content.thresholds.repairAbove} / leaveBelow=${content.thresholds.leaveBelow}）`);
}

console.log('\n=== 结论 ===');
if (failures.length === 0) console.log('  🎉 全部校验通过');
else {
  console.log(`  ${failures.length} 项失败：`);
  failures.forEach((f) => console.log(`   - ${f}`));
}
if (warns.length) console.log(`  ${warns.length} 项提醒：\n   - ${warns.join('\n   - ')}`);
process.exitCode = failures.length === 0 ? 0 : 1;
