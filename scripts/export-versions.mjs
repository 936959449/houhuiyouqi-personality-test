/**
 * 导出 24 版本：CSV（Excel 可直接打开）+ Markdown 表
 * 用法：node scripts/export-versions.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(readFileSync(join(root, 'spec/versions.json'), 'utf8'));
const persons = [...new Set(doc.versions.map((v) => v.person))];
const postures = ['repair', 'wobble', 'leave'];
const label = { repair: '想修复', wobble: '还没想好', leave: '想告别' };
const rows = [];
for (const p of persons) {
  for (const x of postures) {
    const v = doc.versions.find((it) => it.person === p && it.posture === x);
    rows.push({ ...v, postureLabel: label[x] });
  }
}

const csvHeader = ['结果码', '人物', '姿态', '后置定语', '台词', '来源类型', '场景', '时间线', '备注', '来源编号'];
const esc = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
const csv = [csvHeader.map(esc).join(',')]
  .concat(rows.map((r) => [r.code || `HHYQ-${r.initials}-${r.index}`, r.person, r.postureLabel, r.suffix, r.quote, r.quoteType, r.scene, r.when, r.note, r.source].map(esc).join(',')))
  .join('\r\n');
writeFileSync(join(root, 'spec/versions-export.csv'), '\ufeff' + csv + '\r\n', 'utf8');

const md = [];
md.push('# 24 版本导出（' + doc.meta.version + '）');
md.push('');
md.push('> 按「人物 × 想修复 / 还没想好 / 想告别」排列。修改请直接改 `spec/versions.json`，然后跑 `node scripts/sync-doc-versions.mjs`、`node scripts/build-prototype-data.mjs`、`node scripts/build-docs.mjs`。');
md.push('');
md.push('| # | 结果码 | 人物 | 姿态 | 后置定语 | 台词 | 类型 | 场景 |');
md.push('|---|---|---|---|---|---|---|---|');
rows.forEach((r, i) => {
  md.push(`| ${i + 1} | HHYQ-${r.initials}-${r.index} | ${r.person} | ${r.postureLabel} | ${r.suffix} | 「${r.quote}」 | ${r.quoteType} | ${r.scene} |`);
});
md.push('');
md.push('## 导出文件');
md.push('');
md.push('- `spec/versions-export.csv`：Excel 可直接打开的 24 行全字段表');
md.push('- `spec/versions.json`：程序读取源文件');
writeFileSync(join(root, 'docs/24版本导出.md'), md.join('\n') + '\n');
console.log('✅ 已导出：spec/versions-export.csv 与 docs/24版本导出.md（24 行）');
