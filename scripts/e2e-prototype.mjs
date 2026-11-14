/**
 * 原型 v2.2 端到端冒烟测试（jsdom）：
 * 封面 → 开场动画（跳过）→ 连点防跳题/答案确认 → 32 题 → 结果页 → 校验。
 * 用法：npm install jsdom && node scripts/e2e-prototype.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'prototype/index.html'), 'utf8');
const inline = (file) => readFileSync(join(root, 'prototype', file), 'utf8');

const page = html
  .replace('<script src="data.js"></script>', '<script>' + inline('data.js') + '</script>')
  .replace('<script src="scoring.js"></script>', '<script>' + inline('scoring.js') + '</script>')
  .replace('<script src="app.js"></script>', '<script>' + inline('app.js') + '</script>');

const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
const { document } = window;
const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const D = window.HHYQ_DATA;
const S = window.HHYQ_SCORING;
if (!D || !S) throw new Error('数据或计分引擎未加载');

const answers = {};

// 1) 封面 → 开场动画（跳过）
$('#btnStart').click();
await sleep(120);
const introActive = document.querySelector('.screen.is-active').id === 'screen-intro';
$('#btnSkipIntro').click();
await sleep(120);
const quizActive = document.querySelector('.screen.is-active').id === 'screen-quiz';

// 2) 第一题：连点 3 次，只应前进一题；点击后应出现「已记录」
const q1Text = $('#questionText').textContent;
const q1 = D.questions.find((x) => x.text === q1Text);
const first = $('#options .option');
answers[q1.id] = first.dataset.optionId;
first.click();
first.click();
first.click();
await sleep(60);
const confirmText = $('#choiceHint').textContent;
await sleep(520);
const afterRapidIndex = $('#qIndex').textContent;
const afterRapidQ = $('#questionText').textContent;
const rapidChecks = [
  ['连点只前进一题', afterRapidIndex.includes('第 2 /') && afterRapidQ !== q1Text],
  ['点击后显示「已记录」确认', confirmText.includes('已记录') && confirmText.includes(first.dataset.optionId)],
];

// 3) 从第 2 题继续答完
const startIndex = 1;
for (let i = startIndex; i < D.questions.length; i += 1) {
  const text = $('#questionText').textContent;
  const q = D.questions.find((x) => x.text === text);
  if (!q) throw new Error('找不到当前题目: ' + text);
  const opt = $('#options .option');
  answers[q.id] = opt.dataset.optionId;
  opt.click();
  await sleep(430);
}

// 4) 等结果
await sleep(3300);
const expected = S.score(answers);
const active = document.querySelector('.screen.is-active');
const combo = $('#ticketCombo').textContent.trim();
const code = $('#ticketCode').textContent.trim();
const quoteText = $('#quoteText').textContent.trim();

const checks = [
  ['封面 → 开场动画', introActive],
  ['开场动画可跳过 → 进入答题', quizActive],
  ...rapidChecks,
  ['结果页激活', active && active.id === 'screen-result'],
  ['人格拼图与独立计分一致', combo === expected.combo],
  ['结果码一致', code === expected.code],
  ['台词已渲染且与版本一致', quoteText.includes(expected.quote.text)],
  ['台词标注来源类型', $('#quoteMeta').textContent.includes(expected.quote.typeLabel)],
  ['票根底部「姿态/底色/检票」行已移除', document.querySelector('.ticket-foot') === null],
  ['判词里包含姿态', $('#verdict').textContent.includes(expected.posture.label)],
  ['人物关系 2 张', $('#relations').querySelectorAll('.relation-card').length === 2],
  ['三层拼图 3 张', $('#modules').querySelectorAll('.card').length === 3],
  ['雷达已渲染', $('#radar').innerHTML.includes('<polygon')],
  ['九型柱状图 9 行', $('#eneaBars').querySelectorAll('.bar-row').length === 9],
  ['结局给旧友一句话', $('#ending').querySelectorAll('.ending-line').length === 1],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? '✅' : '❌') + ' ' + name);
  if (!ok) failed += 1;
}
console.log('\n实际结果：' + expected.combo + '（' + expected.code + '）');
console.log('页面展示：' + combo + '（' + code + '）');
console.log('台词：' + quoteText);
if (failed) process.exitCode = 1;
