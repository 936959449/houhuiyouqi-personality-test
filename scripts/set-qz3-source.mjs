/**
 * 按用户要求：把青稚「闷头痛哭版」的台词来源类型改为「网友配文」。
 * 用法：node scripts/set-qz3-source.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'spec/versions.json');
const doc = JSON.parse(readFileSync(file, 'utf8'));

doc.meta.quoteTypes['网友配文'] = '网友二创配文/歌词，不是嘉宾本人台词（画面与文字需分开看）';
const v = doc.versions.find((x) => x.id === 'QZ-3');
if (!v) throw new Error('找不到 QZ-3');
v.quoteType = '网友配文';
v.note = '网友二创配文（《泪海》）歌词，不是青稚本人台词；画面为裹毯痛哭。';
doc.meta.version = '2.5.0';
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log('✅ QZ-3 来源类型已改为「网友配文」');
