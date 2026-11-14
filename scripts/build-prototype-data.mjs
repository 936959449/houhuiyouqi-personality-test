/**
 * 生成原型数据：把 spec/ 下的内容资产、v2 版本库与 v2 题库打包成 prototype/data.js
 * 用法：node scripts/build-prototype-data.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const charactersDoc = readJson('spec/characters.json');
const mbtiDoc = readJson('spec/mbti-types.json');
const enneagramDoc = readJson('spec/enneagram.json');
const identitiesDoc = readJson('spec/identities.json');
const versionsDoc = readJson('spec/versions.json');
const questionsDoc = readJson('spec/questions.json');
const combinations = readJson('spec/combinations.json');

const FUNCTIONS = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'];

const data = {
  contentVersion: '2.0.0',
  functions: FUNCTIONS,
  functionName: charactersDoc.meta.functionName,
  disclaimer: charactersDoc.meta.disclaimer,
  characters: charactersDoc.characters,
  charByFunction: Object.fromEntries(charactersDoc.characters.map((c) => [c.function, c])),
  charById: Object.fromEntries(charactersDoc.characters.map((c) => [c.id, c])),
  types: mbtiDoc.types,
  axisOpposite: mbtiDoc.meta.axisOpposite,
  typeByCode: Object.fromEntries(mbtiDoc.types.map((t) => [t.code, t])),
  enneagram: enneagramDoc.types,
  enneagramById: Object.fromEntries(enneagramDoc.types.map((e) => [e.id, e])),
  triads: enneagramDoc.meta.triads,
  identities: identitiesDoc.identities,
  identityById: Object.fromEntries(identitiesDoc.identities.map((i) => [i.id, i])),
  actMeta: identitiesDoc.meta.acts,
  orientationMeta: identitiesDoc.meta.orientations,
  versions: versionsDoc.versions,
  postures: versionsDoc.meta.postures,
  thresholds: versionsDoc.meta.thresholds,
  quoteTypes: versionsDoc.meta.quoteTypes,
  parts: questionsDoc.meta.parts,
  questions: questionsDoc.questions,
  totalCombinations: combinations.meta.count,
};

const banner = `/* 自动生成，勿手改。源：spec/*.json —— 生成脚本：scripts/build-prototype-data.mjs */\n`;
const body = `${banner}(function (root) {\n  root.HHYQ_DATA = ${JSON.stringify(data, null, 2)};\n  if (typeof module !== 'undefined' && module.exports) module.exports = root.HHYQ_DATA;\n}(typeof window !== 'undefined' ? window : globalThis));\n`;
writeFileSync(join(root, 'prototype/data.js'), body);
console.log(
  `✅ prototype/data.js 已生成：${data.questions.length} 题 / ${data.characters.length} 人物 / ${data.versions.length} 版本 / ${data.totalCombinations} 组合`,
);
