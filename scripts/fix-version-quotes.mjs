/**
 * v2.2：修正两条「场景-台词」错位
 *  - 厉娜「列车对谈版」应配「当然，非常久。」
 *  - 马天宇「加回微信版」应配「裂痕是真实存在的。」
 * 用法：node scripts/fix-version-quotes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'spec/versions.json');
const doc = JSON.parse(readFileSync(file, 'utf8'));

const fix = {
  'LN-2': {
    quote: '当然，非常久。',
    quoteType: '原话',
    scene: '列车/对谈环节，被问是否恨过许飞',
    note: '“非常久”承接的是“恨过”，页面需保留提问语境，避免脱离上下文变味。',
  },
  'MTY-2': {
    quote: '裂痕是真实存在的。',
    quoteType: '转述',
    scene: '与张萌重新加回微信后',
    note: '媒体转述；加回微信但回不到从前，是这段关系的收束。',
  },
};

for (const v of doc.versions) {
  if (fix[v.id]) Object.assign(v, fix[v.id]);
}
doc.meta.version = '2.2.0';
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log('✅ 已修正 LN-2 / MTY-2 的场景-台词对应；versions.json → v2.2.0');
