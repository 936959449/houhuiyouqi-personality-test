/**
 * 按用户要求：回退我此前对第 2/3/5/6 条的改动，恢复用户自己改的版本。
 * 保留：第 1 条（厉娜真心话大冒险台词校订）、第 4 条（青稚烧烤道歉→饭桌道歉）。
 * 用法：node scripts/apply-user-version-choice.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'spec/versions.json');
const doc = JSON.parse(readFileSync(file, 'utf8'));

const revert = {
  // 第 2 条：恢复用户原版的「闷头痛哭版」（含原台词/场景/备注）
  'QZ-3': {
    suffix: '闷头痛哭版',
    quote: '你怎么舍得 让我的泪流向海 ',
    quoteType: '原话',
    scene: '长期的委屈在被挚友再次攻击后崩溃',
    note: '情绪崩塌的瞬间。',
    source: 'S20/S21',
  },
  // 第 3 条：恢复用户原版的「悬崖小屋版」（会与许飞重名）
  'QZ-1': { suffix: '悬崖小屋版' },
  // 第 5 条：恢复用户原版的「初次见面版」
  'WJE-2': { suffix: '初次见面版', scene: '初次见面开场陈述' },
  // 第 6 条：恢复用户原版的「穷追猛打版」
  'WJE-3': { suffix: '穷追猛打版' },
};

const log = [];
for (const v of doc.versions) {
  const patch = revert[v.id];
  if (!patch) continue;
  for (const [k, val] of Object.entries(patch)) {
    if (v[k] !== val) {
      log.push(`${v.id} ${v.person}：${k} «${v[k]}» → «${val}»`);
      v[k] = val;
    }
  }
}

doc.meta.version = '2.4.0';
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log('✅ 已按你的要求回退 ' + log.length + ' 处：');
for (const l of log) console.log('  - ' + l);
