/**
 * 构建最终设计文档：合并章节 + 自动生成附录（32题全表 / 组合空间与校验报告）
 * 用法：node scripts/build-docs.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const questionsDoc = readJson('spec/questions.json');
const questions = questionsDoc.questions;
const partsMeta = questionsDoc.meta.parts || [];
const combos = readJson('spec/combinations.json').combinations;
const report = existsSync(join(root, 'spec/validation-report.txt'))
  ? readFileSync(join(root, 'spec/validation-report.txt'), 'utf8').trim()
  : '（尚未生成校验报告）';

const sectionOrder = [
  '00-front',
  '01-overview',
  '02-why',
  '03-theory',
  '04-combo',
  '05-quiz',
  '06-ux',
  '07-content',
  '08-tech',
  '09-plan',
];

const weightLabel = (w) => {
  const parts = [];
  for (const [k, v] of Object.entries(w || {})) {
    if (k === 'act') parts.push(`act=${v}`);
    else if (k === 'repair') parts.push(v > 0 ? '修复+1' : '告别-1');
    else parts.push(`${k}×${v}`);
  }
  return parts.join(' · ');
};

function appendixA() {
  const parts = [];
  const order = [...new Set(questions.map((q) => q.part))];
  let index = 0;
  const lines = [];
  lines.push('# 附录 A：32 题全表（含隐藏权重）');
  lines.push('');
  lines.push('> 权重列仅用于设计与服务端实现；客户端永远不接收该字段。');
  for (const part of order) {
    const qs = questions.filter((q) => q.part === part);
    lines.push('');
    lines.push(`## ${part}（${qs[0].id}–${qs[qs.length - 1].id}，${qs[0].type === 'function' ? '八维' : qs[0].type === 'enneagram' ? '九型' : '关系行动'}）`);
    const meta = partsMeta.find((p) => p.name === part);
    if (meta && meta.intro) {
      lines.push('');
      lines.push(`> 部分引导语：${meta.intro}`);
    }
    for (const q of qs) {
      index += 1;
      lines.push('');
      lines.push(`**${q.id}｜${q.topic}**（${q.type}）`);
      lines.push('');
      lines.push(`> ${q.text}`);
      lines.push('');
      for (const o of q.options) {
        lines.push(`- **${o.id}** ${o.text}　\`${weightLabel(o.weights)}\``);
      }
    }
  }
  return lines.join('\n');
}

function appendixB() {
  const lines = [];
  lines.push('# 附录 B：组合空间与校验报告（v2）');
  lines.push('');
  lines.push('## B1 组合空间');
  lines.push('');
  lines.push(`- 组合总数：**${combos.length}**（8 位人物 × 每人 3 个「节目时间事件版本」）`);
  lines.push('- 组合语法：`{人物}「{后置定语}」`');
  lines.push('- 全量清单：`spec/combinations.json`（每一条都包含一位《后会友期》人物 + 一句本人台词）');
  lines.push('- 生成逻辑：`spec/scoring.mjs` 的 `enumerateCombinations()`');
  lines.push('');
  lines.push('## B2 24 个组合全表');
  lines.push('');
  lines.push('| 结果码 | 人物 | 姿态 | 后置定语 | 台词类型 |');
  lines.push('|---|---|---|---|---|');
  const postureLabel = { repair: '想修复', wobble: '还没想好', leave: '想告别' };
  for (const c of combos) {
    lines.push(`| ${c.code} | ${c.person} | ${postureLabel[c.posture] || c.posture} | ${c.suffix} | ${c.quoteType} |`);
  }
  lines.push('');
  lines.push('## B3 24 条台词速览');
  lines.push('');
  for (const c of combos) {
    lines.push(`- **${c.combo}**（${c.code}）：${c.quote}（${c.quoteType}）`);
  }
  lines.push('');
  lines.push('## B4 校验报告（`node spec/validate.mjs` + `node spec/persona-test.mjs`）');
  lines.push('');
  lines.push('```text');
  lines.push(report);
  lines.push('```');
  lines.push('');
  lines.push('> 复跑命令：`node spec/validate.mjs && node spec/persona-test.mjs`');
  return lines.join('\n');
}

const chunks = sectionOrder.map((name) => read(`docs/sections/${name}.md`).trim());
chunks.push(appendixA());
chunks.push(appendixB());
chunks.push(read('docs/sections/92-appendix-refs.md').trim());

const doc = chunks.join('\n\n---\n\n') + '\n';
writeFileSync(join(root, 'docs/设计方案.md'), doc);
console.log(`✅ docs/设计方案.md 已生成：${doc.length} 字符，${doc.split('\n').length} 行`);
