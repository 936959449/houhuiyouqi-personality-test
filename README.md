# 后会友期 · 人格拼图（v2）

> 基于芒果TV综艺《后会友期》8 位嘉宾的网页趣味人格测试方案 —— **32 道题，约 5 分钟，生成一个"人物 + 节目时间事件版本"的唯一组合**。
> 示例结果：**许飞「悬崖小屋版」**、**王子璇「露天烧烤版」**、**白小纯「道歉现场版」**——名字下方配该人物本人一句台词。

本仓库包含 **v2 完整设计方案**、**可跑通的计分引擎与校验**、以及一个 **可点击的交互原型 v2**。

---

## 一、先看什么

| 入口 | 说明 |
|---|---|
| **[docs/设计方案.md](docs/设计方案.md)** | 主交付：v2 完整设计方案（组合系统、24 版本与台词、开场动画、题目计分、UX、内容体系、技术、合规、附录） |
| **[prototype/index.html](prototype/index.html)** | 可玩原型 v2：封面 → 可跳过开场动画 → 32 题 → 票根人格拼图（浏览器直接打开即可） |
| **[research/quotes-v2.md](research/quotes-v2.md)** | 8 位嘉宾金句库存（3 主选 + 2 备选，含来源与安全备注） |
| **[research/characters.md](research/characters.md)** | 节目与 8 位嘉宾公开资料研究（含 25 条来源与未核实清单） |

## 二、核心数字（v2）

| 项 | 值 |
|---|---|
| 结果格式 | `{人物}「{后置定语}」`，例：许飞「悬崖小屋版」 |
| 组合空间 | **24** = 8 位人物 × 每位人物单独设计的 3 个「节目时间事件版本」 |
| 每个组合 | 组合名 + 该人物本人一句台词（标注 原话/转述/书面/节目外）+ 关系姿态 |
| 关系姿态 | 想修复 / 还没想好 / 想告别（由修复指数三档切分） |
| 完整底色 | 荣格八维 → 人物；MBTI 式 16 型；九型人格 9 型；关系身份 8 种（结果页中段展示） |
| 题量 | 32 题（八维 16 / 九型 9 / 关系行动 7），约 5 分钟；权重未改 |
| 开场 | 8–12 秒可跳过文字动画：先想起那个走散的人，再上车 |

## 三、快速开始

### 1. 玩原型

直接用浏览器打开 `prototype/index.html`（无需构建）。也可以起静态服务：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/prototype/
```

### 2. 跑校验

```bash
node spec/validate.mjs        # 24 组合唯一性 / 版本覆盖 / 32题配平 / 10万次模拟分布
node spec/persona-test.mjs    # 24 组合可达性（无死组合）
```

最新结果见 `spec/validation-report.txt`。

### 3. 重建文档 / 原型数据

```bash
node scripts/build-docs.mjs              # docs/sections/*.md + 自动附录 → docs/设计方案.md
node scripts/build-prototype-data.mjs    # spec/*.json → prototype/data.js
```

### 4. 原型端到端测试（可选，需要 jsdom）

```bash
npm install jsdom
node scripts/e2e-prototype.mjs
```

## 四、目录结构

```
.
├─ docs/
│  ├─ 设计方案.md          # v2 主交付（自动生成，勿手改）
│  └─ sections/            # 分章节源文件（改这里，再跑 build-docs）
├─ spec/
│  ├─ characters.json      # 8 位人物卡
│  ├─ versions.json        # ★ v2 版本库：24 个「人物 × 时间事件版本」+ 台词
│  ├─ mbti-types.json      # 16 型 × 主/副人物
│  ├─ enneagram.json       # 九型 × 形容词 × 三元组
│  ├─ identities.json      # 8 种关系身份
│  ├─ questions.json       # 32 题（v2 题面、权重未变，服务端资产）
│  ├─ combinations.json    # 24 个组合全量索引
│  ├─ scoring.mjs          # 计分引擎 v2
│  ├─ validate.mjs         # 内容 / 唯一性 / 配平 / 分布校验
│  ├─ persona-test.mjs     # 24 组合可达性测试
│  └─ validation-report.txt
├─ prototype/              # 可玩原型 v2（index.html + data.js + scoring.js + app.js + style.css）
├─ scripts/                # 构建与测试脚本
└─ research/               # 节目研究 / 金句库存 / v2 题库
```

## 五、几个关键设计点

1. **为什么组合是 24 个**：人物从主导功能来（8 选 1）；每个人物单独设计 3 个「节目时间事件版本」；关系姿态（想修复/还没想好/想告别）决定你落到哪一个。不是"3 个通用后缀 × 8 个人"。
2. **台词怎么保证真实**：每个版本配一句该人物本人说过/写下的话，标注 **原话 / 转述 / 书面 / 原话·节目外** 与场景；转述不冒充逐字字幕，节目外不冒充正片。
3. **唯一性怎么保证**：8×3 = 24 个组合名互不重复；24 个后置定语互不重复；每人三姿态各一个；脚本全量校验 + 人设可达性 24/24。
4. **完整底色去哪了**：16 型 × 9 九型 × 8 身份仍全量计算，在结果页中段展示；只是不再挤进名字。
5. **合规前置**：非官方二创声明、台词来源标注、争议台词零容忍、不用官方海报/剧照/肖像、匿名数据、不做心理诊断。

## 六、v2 变更速记

- 组合名：5 段式 1,152 种 → `{人物}「{版本}」` 24 种
- 新增：每人 3 个节目时间事件版本；每个版本一句本人台词
- 新增：8–12 秒可跳过开场动画（"先把 TA 想成那个走散的人"）
- 改写：32 题题面统一成"你和 TA 的 18 天"叙事（**权重逐字节未变**，配平/唯一性全部通过）
- 重排：人格拼图（含台词）→ 判词 → 人物关系 → 本我/关系/社会位 → 数据卡 → 结局 & 一句话

## 七、重要声明

本方案为《后会友期》**非官方粉丝向二创设计**，仅供娱乐。人物解读为节目语境下的创意演绎，不代表对真实人物的评价，也不代表节目组立场。本测试不构成任何心理学诊断。节目名称、人物姓名与台词相关权利归原权利人所有；商业化前需取得相关授权。

## 八、部署到 GitHub Pages（在线试玩）

仓库已内置 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)：推送到 `main` 后自动把 `prototype/` 发布为网站。

1. 在 GitHub 新建仓库并推送本项目（见下方命令）。
2. 打开仓库 **Settings → Pages**，Source 选 **GitHub Actions**（首次也可由 workflow 自动启用）。
3. 等 `Deploy prototype to GitHub Pages` 变绿，访问：

```
https://<你的GitHub用户名>.github.io/<仓库名>/
```

本地预览（不需要 GitHub）：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/prototype/
```

推送命令（首次）：

```bash
git remote add origin https://github.com/<用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

---

*方案版本：v2.0（2026-11-14）*
