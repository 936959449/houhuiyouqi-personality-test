/**
 * 通过 GitHub REST API 把当前工作区提交到空仓库（适用于 git push 网络被阻断的环境），
 * 然后触发 Pages workflow 并验证站点。
 *
 * 用法（token 由环境变量传入，不落盘、不打印）：
 *   $env:GH_TOKEN = '...'; node scripts/deploy-github-api.mjs
 *
 * 注意：只用于初始化/覆盖式提交；日常迭代建议正常 git push。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = process.env.GH_OWNER || '936959449';
const REPO = process.env.GH_REPO || 'houhuiyouqi-personality-test';
const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) throw new Error('缺少 GH_TOKEN');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const api = async (method, endpoint, body) => {
  const res = await fetch('https://api.github.com' + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'dsh-deploy',
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = typeof data === 'string' ? data.slice(0, 600) : JSON.stringify(data).slice(0, 600);
    throw new Error(`${method} ${endpoint} → ${res.status} ${detail}`);
  }
  return data;
};

const IGNORE_DIRS = new Set(['.git', 'node_modules', '.tmp_test', '.out']);
const files = [];
function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), relPath);
    } else if (entry.isFile()) {
      files.push({ abs: path.join(dir, entry.name), rel: relPath });
    }
  }
}
walk(root);
files.sort((a, b) => a.rel.localeCompare(b.rel));
if (files.length > 120) throw new Error('文件数异常：' + files.length);
console.log(`准备提交 ${files.length} 个文件到 ${OWNER}/${REPO}`);

// 0) 空仓库不能直接创建 blob：先用 Contents API 建一个初始提交
let parentSha = null;
try {
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  parentSha = ref.object.sha;
  console.log('仓库已有初始提交：', parentSha.slice(0, 8));
} catch (e) {
  console.log('空仓库，创建初始提交…');
  await api('PUT', `/repos/${OWNER}/${REPO}/contents/README.md`, {
    message: 'chore: init repo',
    content: Buffer.from('# 后会友期 · 人格拼图\n').toString('base64'),
  });
  const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  parentSha = ref.object.sha;
  console.log('初始提交：', parentSha.slice(0, 8));
}

// 1) blobs
const treeEntries = [];
for (let i = 0; i < files.length; i += 1) {
  const f = files[i];
  const content = fs.readFileSync(f.abs);
  const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: content.toString('base64'),
    encoding: 'base64',
  });
  treeEntries.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha });
  if ((i + 1) % 10 === 0) console.log(`  blobs ${i + 1}/${files.length}`);
}

// 2) tree
const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree: treeEntries });

// 3) commit
const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
  message: 'feat: 后会友期·人格拼图 v2.5（24 版本 / 32 题 / 可玩原型 + Pages 部署）',
  tree: tree.sha,
  parents: parentSha ? [parentSha] : [],
});

// 4) 更新 main 分支
await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha, force: true });
console.log('✅ 已更新 main 分支');
const commitUrl = `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`;
console.log('commit:', commitUrl);

// 5) 触发 Pages workflow（仓库刚创建时 workflow 索引可能有延迟，重试）
let dispatched = false;
for (let attempt = 0; attempt < 8; attempt += 1) {
  try {
    await api('POST', `/repos/${OWNER}/${REPO}/actions/workflows/pages.yml/dispatches`, { ref: 'main' });
    dispatched = true;
    break;
  } catch (e) {
    console.log(`  触发 workflow 第 ${attempt + 1} 次失败：${String(e.message).slice(0, 160)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
if (!dispatched) throw new Error('无法触发 Pages workflow');

// 6) 等 workflow 跑完
let run = null;
for (let i = 0; i < 36; i += 1) {
  await new Promise((r) => setTimeout(r, 5000));
  const runs = await api('GET', `/repos/${OWNER}/${REPO}/actions/runs?per_page=5`);
  run = (runs.workflow_runs || []).find((r) => r.name === 'Deploy prototype to GitHub Pages');
  if (run && run.status === 'completed') break;
  if (i % 3 === 0) console.log(`  workflow: ${run ? run.status + '/' + run.conclusion : '等待中'}`);
}
if (!run) throw new Error('没有找到 workflow run');
console.log(`workflow: status=${run.status} conclusion=${run.conclusion}`);
console.log('run:', run.html_url);
if (run.conclusion !== 'success') {
  throw new Error('Pages workflow 未成功：' + run.conclusion);
}

// 7) 读取 Pages 地址并验证
const pages = await api('GET', `/repos/${OWNER}/${REPO}/pages`);
const url = pages.html_url;
console.log('pages:', url, 'status=', pages.status);
try {
  const res = await fetch(url, { redirect: 'follow' });
  console.log('HTTP:', res.status, res.ok ? '（站点可访问）' : '（暂不可访问，可能还在生效）');
} catch (e) {
  console.log('站点 fetch 失败（本机网络可能阻断 github.io）：', String(e.message).slice(0, 120));
}
console.log('\n部署完成：');
console.log('  repo : https://github.com/' + OWNER + '/' + REPO);
console.log('  site : ' + url);
