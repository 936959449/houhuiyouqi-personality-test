/**
 * 内容规整（按用户最终决定，仅保留 2 处客观修正）：
 * 1. 厉娜「真心话大冒险版」台词改为公开报道措辞并标“转述”
 * 2. 青稚「饭桌道歉版」修正场景与后缀不符（原“烧烤道歉版”）
 *
 * 用户明确保留的其余改动（QZ-3 闷头痛哭版、QZ-1 悬崖小屋版、WJE-2 初次见面版、WJE-3 穷追猛打版）
 * 不再覆盖，本脚本不会回退它们。
 *
 * 用法：node scripts/normalize-user-versions.mjs（幂等，不会重复改已改过的字段）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'spec/versions.json');
const doc = JSON.parse(readFileSync(file, 'utf8'));

const fixes = {
  'LN-1': {
    quote: '除了带有攻击性，是喜欢的。',
    quoteType: '转述',
    scene: '进藏列车上的真心话大冒险：被问“抛开所有矛盾，你觉得许飞有魅力吗？你喜不喜欢？”',
    note: '媒体转述；公开报道措辞为“除了带有攻击性，是喜欢的”，非逐字字幕。',
  },
  'QZ-2': { suffix: '饭桌道歉版' },
};

let changed = 0;
for (const v of doc.versions) {
  const patch = fixes[v.id];
  if (!patch) continue;
  for (const [k, val] of Object.entries(patch)) {
    if (v[k] !== val) {
      v[k] = val;
      changed += 1;
    }
  }
}
if (changed) {
  doc.meta.version = '2.4.1';
  writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
}
console.log(changed ? `✅ 已应用 ${changed} 处保留修正` : '✅ 无需修改（已是目标内容）');
