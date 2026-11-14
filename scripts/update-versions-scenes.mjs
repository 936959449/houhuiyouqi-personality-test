/**
 * v2.1：把 24 个版本的后置定语全部改成「节目里的具体事件 / 场景」
 * 用法：node scripts/update-versions-scenes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'spec/versions.json');
const doc = JSON.parse(readFileSync(file, 'utf8'));

const sceneMap = {
  'XF-1': { suffix: '悬崖小屋版', scene: '悬崖小屋对谈后段，回应厉娜的指控' },
  'XF-2': { suffix: '读完长信版', scene: '悬崖小屋，当面读长信念到一半哽咽' },
  'XF-3': { suffix: '收官长信版', scene: '收官长信结尾' },
  'LN-1': { suffix: '小屋对坐版', scene: '悬崖小屋对坐，看到许飞状态后软下来' },
  'LN-2': { suffix: '列车对谈版', scene: '列车/对谈环节，被问是否恨过许飞' },
  'LN-3': { suffix: '心结卡版', scene: '心结卡环节（被念出 / 展示）' },
  'MTY-1': { suffix: '饭桌劝解版', scene: '饭桌劝王子璇处理与文吉儿的旧账' },
  'MTY-2': { suffix: '加回微信版', scene: '与张萌重新加回微信后' },
  'MTY-3': { suffix: '机场版', scene: '录制结束后在机场对粉丝说（非正片）' },
  'ZM-1': { suffix: '谈心自责版', scene: '谈心环节，看到马天宇崩溃落泪后的自责' },
  'ZM-2': { suffix: '马克杯版', scene: '与马天宇和解当场，拿出攒了十年的马克杯' },
  'ZM-3': { suffix: '白发邀约版', scene: '往事复盘：她复述 2018 年《白发》邀约时那句气话' },
  'WZX-1': { suffix: '饭桌破冰版', scene: '后期饭桌：张萌玩笑踩雷，她笑着接梗化尴尬' },
  'WZX-2': { suffix: '对质现场版', scene: '悬崖小屋对质后、退款前的自我陈述' },
  'WZX-3': { suffix: '露天烧烤版', scene: '烧烤店，吃烧烤时她鼓起勇气说出心里话' },
  'WJE-1': { suffix: '转账记录版', scene: '悬崖小屋，出示保存八年的转账记录时' },
  'WJE-2': { suffix: '小屋开场版', scene: '悬崖小屋开场陈述' },
  'WJE-3': { suffix: '烧烤店追问版', scene: '烧烤店，追问王子璇当年为何收下三万元' },
  'BXC-1': { suffix: '道歉现场版', scene: '青稚道歉后，他的回应' },
  'BXC-2': { suffix: '念卡版', scene: '悬崖小屋心结卡环节，被要求当众念出' },
  'BXC-3': { suffix: '饭桌对质版', scene: '悬崖小屋和解后，饭桌上当着众人对青稚说' },
  'QZ-1': { suffix: '泉灵提问版', scene: '悬崖小屋，张泉灵问“你们是不是从头就不是一样的人”之后' },
  'QZ-2': { suffix: '饭桌道歉版', scene: '饭桌，被“不可能原谅”击中后的回应' },
  'QZ-3': { suffix: '争吵现场版', scene: '悬崖小屋争吵（本想说“归咎”，口误成“归功”）' },
};

const suffixes = new Set();
for (const v of doc.versions) {
  const next = sceneMap[v.id];
  if (!next) throw new Error('缺少映射：' + v.id);
  v.suffix = next.suffix;
  v.scene = next.scene;
  if (suffixes.has(v.suffix)) throw new Error('后缀重复：' + v.suffix);
  suffixes.add(v.suffix);
}
if (doc.versions.length !== 24) throw new Error('版本数量不是 24');
doc.meta.version = '2.1.0';
doc.meta.note =
  '结果名 =「人物 + 后置定语」：{人物}「{后缀}」。24 个唯一组合 = 8 位人物 × 每位人物单独设计的 3 个「节目时间事件版本」。后缀必须是节目里的具体事件或场景（不用抽象形容词/台词概括）；版本由关系姿态（想修复 / 还没想好 / 想告别）决定，每个版本配一句该人物本人说过（或写下）的话。';
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log('✅ versions.json 已更新为具体事件/场景后缀：');
for (const v of doc.versions) console.log(`  ${v.person} / ${v.posture} → ${v.suffix}`);
