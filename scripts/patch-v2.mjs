/**
 * v2 数据迁移：人物补 initials、修正文吉儿台词、合并 v2 题库
 * 用法：node scripts/patch-v2.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const writeJson = (p, data) => writeFileSync(join(root, p), JSON.stringify(data, null, 2) + '\n');

const initials = {
  xufei: 'XF',
  lina: 'LN',
  matianyu: 'MTY',
  zhangmeng: 'ZM',
  wangzixuan: 'WZX',
  wenjier: 'WJE',
  baixiaochun: 'BXC',
  qingzhi: 'QZ',
};

const characters = readJson('spec/characters.json');
for (const c of characters.characters) c.initials = initials[c.id];
const wen = characters.characters.find((c) => c.id === 'wenjier');
wen.quote = '“今天摊开，就是想要一个答案，想翻篇。”（媒体还原对话）';
characters.meta.version = '2.0.0';
writeJson('spec/characters.json', characters);
console.log('✅ characters.json：已补 initials，文吉儿台词已更正');

const v2 = readJson('research/questions-v2.json');
writeJson('spec/questions.json', v2);
console.log(`✅ questions.json：已合并 v2 题库（${v2.questions.length} 题 / ${v2.meta.parts.length} 个部分）`);
