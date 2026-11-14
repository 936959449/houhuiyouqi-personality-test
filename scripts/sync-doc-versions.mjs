/**
 * 把 spec/versions.json 的最新版本同步进 docs/sections（表格 + 版本清单），
 * 避免每次手改后文档里的 24 版本表陈旧。
 * 用法：node scripts/sync-doc-versions.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versions = JSON.parse(readFileSync(join(root, 'spec/versions.json'), 'utf8')).versions;
const persons = [...new Set(versions.map((v) => v.person))];
const postures = ['repair', 'wobble', 'leave'];
const postureLabel = { repair: '想修复', wobble: '还没想好', leave: '想告别' };
const pick = (person, posture) => versions.find((v) => v.person === person && v.posture === posture);

const gridTable = () => {
  const lines = ['| 人物 | 想修复 | 还没想好 | 想告别 |', '|---|---|---|---|'];
  for (const p of persons) {
    lines.push(`| ${p} | ${postures.map((x) => pick(p, x).suffix).join(' | ')} |`);
  }
  return lines.join('\n');
};

const fullTable = () => {
  const lines = ['| 人物 | 姿态 | 后置定语 | 台词 | 类型 | 场景 |', '|---|---|---|---|---|---|'];
  for (const p of persons) {
    for (const x of postures) {
      const v = pick(p, x);
      lines.push(`| ${v.person} | ${postureLabel[x]} | ${v.suffix} | 「${v.quote}」 | ${v.quoteType} | ${v.scene} |`);
    }
  }
  return lines.join('\n');
};

function replaceTableBlock(text, header, newBlock) {
  const start = text.indexOf(header);
  if (start === -1) throw new Error('找不到表格头：' + header);
  const before = text.slice(0, start);
  const rest = text.slice(start);
  const lines = rest.split('\n');
  let end = 2; // header + separator
  while (end < lines.length && lines[end].startsWith('|')) end += 1;
  const block = newBlock.split('\n');
  const next = [...lines.slice(0, 2), ...block.slice(2), ...lines.slice(end)];
  return before + next.join('\n');
}

const gridHeader = '| 人物 | 想修复 | 还没想好 | 想告别 |';
const fullHeader = '| 人物 | 姿态 | 后置定语 | 台词 | 类型 | 场景 |';

for (const f of ['docs/sections/03-theory.md', 'docs/sections/04-combo.md']) {
  const p = join(root, f);
  let t = readFileSync(p, 'utf8');
  t = replaceTableBlock(t, gridHeader, gridTable());
  writeFileSync(p, t);
  console.log('✅ 同步表格：' + f);
}

{
  const p = join(root, 'docs/sections/07-content.md');
  let t = readFileSync(p, 'utf8');
  t = replaceTableBlock(t, fullHeader, fullTable());
  // 人物卡里的「版本：」清单
  const lists = {
    许飞: pick('许飞', 'repair').suffix + ' / ' + pick('许飞', 'wobble').suffix + ' / ' + pick('许飞', 'leave').suffix,
    厉娜: pick('厉娜', 'repair').suffix + ' / ' + pick('厉娜', 'wobble').suffix + ' / ' + pick('厉娜', 'leave').suffix,
    马天宇: pick('马天宇', 'repair').suffix + ' / ' + pick('马天宇', 'wobble').suffix + ' / ' + pick('马天宇', 'leave').suffix,
    张萌: pick('张萌', 'repair').suffix + ' / ' + pick('张萌', 'wobble').suffix + ' / ' + pick('张萌', 'leave').suffix,
    王子璇: pick('王子璇', 'repair').suffix + ' / ' + pick('王子璇', 'wobble').suffix + ' / ' + pick('王子璇', 'leave').suffix,
    文吉儿: pick('文吉儿', 'repair').suffix + ' / ' + pick('文吉儿', 'wobble').suffix + ' / ' + pick('文吉儿', 'leave').suffix,
    白小纯: pick('白小纯', 'repair').suffix + ' / ' + pick('白小纯', 'wobble').suffix + ' / ' + pick('白小纯', 'leave').suffix,
    青稚: pick('青稚', 'repair').suffix + ' / ' + pick('青稚', 'wobble').suffix + ' / ' + pick('青稚', 'leave').suffix,
  };
  t = t.replace(/^- 版本：.*$/gm, (m) => {
    // 根据上一行的「### 人物｜...」判断人物
    const idx = t.indexOf(m);
    const head = t.slice(0, idx);
    const last = head.lastIndexOf('### ');
    const line = head.slice(last, head.indexOf('\n', last));
    const person = Object.keys(lists).find((p) => line.startsWith('### ' + p + '｜'));
    return person ? '- 版本：' + lists[person] + '。' : m;
  });
  writeFileSync(p, t);
  console.log('✅ 同步表格 + 人物卡版本清单：docs/sections/07-content.md');
}

// 00 / 04 里出现的许飞三版本示例
for (const f of ['docs/sections/00-front.md', 'docs/sections/04-combo.md']) {
  const p = join(root, f);
  let t = readFileSync(p, 'utf8');
  t = t.replace(
    '（如许飞：悬崖小屋版 / 读完长信版 / 收官长信版）',
    `（如许飞：${pick('许飞', 'repair').suffix} / ${pick('许飞', 'wobble').suffix} / ${pick('许飞', 'leave').suffix}）`,
  );
  t = t.replace(
    '（如许飞的「悬崖小屋版 / 读完长信版 / 收官长信版」',
    `（如许飞的「${pick('许飞', 'repair').suffix} / ${pick('许飞', 'wobble').suffix} / ${pick('许飞', 'leave').suffix}」`,
  );
  writeFileSync(p, t);
}
console.log('✅ 同步 00/04 的许飞示例');
