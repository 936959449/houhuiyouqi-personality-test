# 八、技术方案

## 8.1 架构总览

```mermaid
flowchart LR
  subgraph 客户端
    H5[移动端 H5<br/>Next.js + Tailwind + Motion]
  end
  subgraph 服务端
    API[Next.js Route Handlers<br/>或独立 Fastify 服务]
    SCORE[计分模块<br/>@hhyq/scoring 纯函数]
    CARD[分享卡渲染<br/>Satori + Resvg]
    DB[(PostgreSQL<br/>Prisma)]
    REDIS[(Redis<br/>限流/缓存, 可选)]
  end
  subgraph 外部
    CDN[CDN / OSS]
    WX[微信 JS-SDK]
    MON[监控 Sentry + 日志]
  end
  H5 -->|题目/提交/结果| API
  API --> SCORE
  API --> DB
  API --> REDIS
  API --> CARD
  CARD --> CDN
  H5 --> CDN
  H5 --> WX
  API --> MON
```

**核心原则**

1. **权重永不下发**：客户端只拿到题干与选项文案，选项权重与计分逻辑全部在服务端；即使抓包也拿不到"选哪个得什么分"。
2. **计分是纯函数**：`score(answers, questions) → result`，可单测、可离线复算、可版本化；页面与接口只做 IO。
3. **内容与代码分离**：人物、类型、九型、身份、题库都是 JSON 资产，支持灰度与回滚，不因改文案发版。
4. **结果不可枚举**：结果 ID 用 UUID，公开分享用短码（需服务端换取），防止遍历数据库。

## 8.2 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | Next.js 15（App Router）+ React 19 + TypeScript | SSR 分享落地页、路由/API 一体、生态成熟 |
| 样式 | Tailwind CSS + CSS 变量（Design Tokens） | 快速实现票根/丹霞视觉，便于主题化 |
| 动效 | Motion（Framer Motion） | 票根入场/盖章/雷达生长，支持 reduced-motion |
| 状态 | Zustand（答题进度）+ localStorage 持久化 | 轻量，断点续答 |
| 图表 | 自绘 SVG（雷达/条形） | 体积极小，可精确控制视觉 |
| 后端 | Next.js Route Handlers（MVP）→ 可拆 Fastify 独立服务 | 先单仓提效，量起来再拆计分服务 |
| 计分 | 纯 TypeScript 模块 `@hhyq/scoring`（与 spec/scoring.mjs 同逻辑） | 单测 + 复用原型逻辑，杜绝两套实现 |
| 数据库 | PostgreSQL 16 + Prisma | 结构化、事务、易运维 |
| 缓存/限流 | Redis 7（可选，MVP 用内存限流） | 防刷、会话缓存 |
| 分享卡 | `satori`（JSX → SVG）+ `@resvg/resvg-js`（SVG → PNG） | 服务端渲染，字体可控、无水印、可缓存 |
| 二维码 | `qrcode`（服务端生成 SVG/PNG） | 无依赖、清晰 |
| 监控 | Sentry + 结构化日志 | 错误追踪与漏斗 |
| 测试 | Vitest（单测）+ Playwright（E2E）+ Lighthouse CI | 覆盖算法/内容/性能 |

## 8.3 前端页面与路由

| 路由 | 页面 | 渲染 | 说明 |
|---|---|---|---|
| `/` | 封面页 | SSR/ISR | 首屏快；社会证明数据可缓存 60s |
| `/quiz` | 答题页 | CSR | 题目数据一次性拉取（无权重），本地渲染 |
| `/result/[id]` | 结果页 | SSR | 带完整结果内容，便于截图/分享 |
| `/r/[code]` | 短码落地页 | SSR | 分享链接入口，自动跳结果页 |
| `/pair` | 双人模式（v1.1） | CSR | 输入码/邀请 |
| `/about` | 关于与声明 | SSG | 免责声明全文 |

**前端性能预算**：4G 网络 LCP < 2.0s；首屏 JS（gzip）< 180KB；字体子集化（只含用到的中文常用字 + 标题字重）；图片 WebP/AVIF，人物视觉用 SVG/CSS 生成而非位图。

## 8.4 API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/v1/sessions` | 创建匿名会话，返回 `sessionId` + 签名 token + 题目版本 |
| `GET` | `/api/v1/quiz` | 获取题目（**不含权重**）、部分配置、选项顺序 seed |
| `PUT` | `/api/v1/sessions/:id/answers` | 批量保存作答（幂等 upsert），返回进度 |
| `POST` | `/api/v1/sessions/:id/submit` | 服务端计分并落库，返回 `resultId` + 短码；幂等（重复提交返回同一结果） |
| `GET` | `/api/v1/results/:id` | 结果详情（组合名、台词与来源、三层模块、雷达、关系、结局） |
| `GET` | `/api/v1/results/:id/card.png?template=ticket` | 分享海报（服务端渲染，CDN 缓存） |
| `GET` | `/api/v1/r/:code` | 短码解析 → 结果 ID |
| `POST` | `/api/v1/pairs`（v1.1） | 双人报告（两人都完成后生成） |
| `GET` | `/api/v1/stats` | 只读统计（"已有 xx 人上车"） |
| `GET` | `/healthz` | 健康检查 |

**提交校验（服务端）**

- 题目版本必须匹配；答案必须 ≥ 28 题且题号/选项存在；
- 每个 session 只能生成一个结果（幂等）；
- 限流：单 IP 30 次/小时创建会话、10 次/分钟提交；token 签名校验；
- 不记录 IP 明文（可存哈希，用于风控）；不采集手机号/昵称等 PII。

## 8.5 数据模型（Prisma 概览）

```
QuizVersion   id, version, questionsJson(引用), status, createdAt
Question      id, quizVersionId, part, type, text, order, options(JSON 含权重，服务端专用)
Version       id, personId, suffix, posture, quote, quoteType, scene, when, note   (内容资产，v2)
Session       id(uuid), tokenHash, quizVersionId, createdAt, userAgentHash, status
Answer        id, sessionId, questionId, optionId, answeredAt, elapsedMs
Result        id(uuid), sessionId, shortCode(uniq), combo, personId, versionId, posture,
              typeCode, enneagramId, wing, identityId, scoresJson, contentVersion, createdAt
ShareEvent    id, resultId, channel, utmSource, createdAt
PairReport    id, codeA, codeB, compatibility, archetype, createdAt   (v1.1)
```

> 说明：`Question.options` 里含权重，属于服务端资产；`GET /api/v1/quiz` 序列化时显式剔除 `weights` 字段。

## 8.6 计分服务（与设计文档同源）

- 代码位置：`packages/scoring/`（或 `src/lib/scoring/`），从 `spec/scoring.mjs` 直接移植；
- 输入：`answers[]` + `questions`（含权重）+ `content`（人物/类型/九型/身份）；
- 输出：`ResultPayload`（组合名、台词与来源、人物/版本/姿态、完整底色、雷达、关系、结局、结果码）；
- 单测：唯一性（24 组合）、版本覆盖（每人 3 个）、配平、人设可达性（24）、并列仲裁可复现性、内容 schema；
- 内容资产在构建期校验（CI 中跑 `validate.mjs` 的等价 TS 版本），不通过则构建失败。

**文本渲染**：判词/结局/关系位由模板函数拼装（`renderResult(payload) → { segments, verdict, relations, ending }`），模板与文案分文件管理，便于运营调整。

## 8.7 分享海报生成

| 步骤 | 实现 |
|---|---|
| 1. 请求 | `GET /api/v1/results/:id/card.png?template=ticket&v=2` |
| 2. 渲染 | `satori` 用 JSX 渲染 1080×1920 布局（票根 + 组合名 + 判词 + 二维码） |
| 3. 栅格化 | `@resvg/resvg-js` 输出 PNG（或 `sharp` 压缩） |
| 4. 缓存 | 按 `resultId + template + contentVersion` 缓存到 CDN/OSS，TTL 7 天 |
| 5. 防伪 | 海报由服务端生成，组合名与台词来自数据库，客户端无法伪造 |
| 6. 追踪 | 二维码 URL 带 `utm_source=poster&utm_medium={channel}` |
| 7. 台词标注 | 海报上的台词必须带来源类型小字（原话/转述/书面/节目外），与结果页一致 |

字体：海报需要中文宋体/黑体子集（satori 需要字体文件），构建时按文案字符集做子集化，控制在 200KB 内。

## 8.8 埋点与实验

**事件表**（前端上报 → 服务端批量写入/第三方）：

| 事件 | 关键字段 |
|---|---|
| `view_home` | utm, referrer |
| `click_start` | — |
| `view_intro` / `skip_intro` | 停留时长 |
| `view_question` | qid, index |
| `answer_question` | qid, optionId, elapsedMs |
| `back_question` | qid |
| `abandon` | lastQid, elapsed |
| `submit_success` | resultId, typeCode |
| `view_result` | resultId, combo, posture |
| `click_quote` | versionId |
| `click_share` / `share_success` | channel |
| `click_poster` | template |
| `replay` | — |

**核心看板**：漏斗（访问→开始→完成→分享）、题目放弃率 Top5、选项分布熵、结果分布（16 型/九型/身份）、分享渠道、双人模式转化（v1.1）。

**A/B 实验**：封面 hook、结果页判词长度、海报模板；通过 `contentVersion` + 灰度开关控制。

## 8.9 部署与国内合规

| 事项 | 方案 |
|---|---|
| 部署 | 腾讯云/阿里云轻量应用服务器 + Docker（Node 20）+ Nginx；或 Serverless（腾讯云函数） |
| 域名 | 已备案域名（微信内 H5 必须 ICP 备案 + HTTPS） |
| CDN | 静态资源与海报走 CDN/OSS，回源服务器 |
| 微信 | JS-SDK 配置分享标题/描述/缩略图；微信内需域名已备案且加入业务域名 |
| 数据库 | 云数据库 PostgreSQL（MVP 可用 SQLite 本地开发） |
| 监控 | Sentry + 云监控；错误率/延迟告警 |
| 备份 | 每日自动备份 Result 表（只读归档） |
| 隐私 | 隐私政策页；匿名会话；不采集 PII；结果可删除（提供"删除我的结果"入口） |

## 8.10 目录结构建议

```
hhyq-test/
├─ apps/web/                 # Next.js 应用
│  ├─ app/                   # 路由（/、/quiz、/result/[id]、/r/[code]、/about）
│  ├─ components/            # 票根、座位卡、雷达、进度列车…
│  ├─ lib/                   # api client、埋点、状态
│  └─ styles/
├─ packages/scoring/         # 计分纯函数 + 模板渲染
│  ├─ src/score.ts
│  ├─ src/render.ts
│  └─ test/                  # 唯一性、配平、人设可达性
├─ content/                  # 内容资产（characters/mbti/enneagram/identities/questions）
│  └─ quiz-v1.0.0/
├─ prisma/schema.prisma
└─ scripts/                  # 校验、导入、海报字体子集化
```

## 8.11 测试策略

| 层级 | 内容 | 工具 |
|---|---|---|
| 单元 | 计分、类型判定、tie-break、模板渲染 | Vitest |
| 内容 | 唯一性 24、版本覆盖 8×3、配平、schema、敏感词扫描 | Node 脚本 + CI |
| 人设 | 24 组合可达性 | `persona-test` 的 TS 版本 |
| E2E | 32 题完整流程 → 结果 → 海报下载；断点续答；重复提交幂等 | Playwright |
| 兼容 | iOS Safari / Android Chrome / 微信内置浏览器；375/390/430 宽度 | 真机 + Playwright |
| 性能 | Lighthouse CI（LCP/CLS/INP） | Lighthouse CI |
| 安全 | 权重不下发、越权访问结果、限流、XSS（文案转义） | 手工 + 脚本 |
| 压测 | 提交接口 500 QPS | k6 |

## 8.12 关键实现注意

1. **选项乱序**：服务端按 `sessionId + questionId` 生成稳定 seed，返回乱序后的选项；权重按 optionId 映射，乱序不影响计分。
2. **断点续答**：localStorage 存 `{sessionId, answers}`，进入答题页先拉服务端进度并合并（以服务端为准，本地补差）。
3. **幂等提交**：`submit` 以 session 维度加锁（数据库唯一索引），重复请求返回已有结果。
4. **文案转义**：所有结果文案由服务端模板生成，禁止把用户输入拼进 HTML（本产品暂无 UGC）。
5. **台词合规**：每句台词必须带 `quoteType`（原话/转述/书面/节目外）与场景，前端按类型渲染标签；运营后台改台词必须保留来源字段，否则构建失败。
6. **降级**：海报渲染失败时回退前端 Canvas 版（简化视觉），保证"永远有海报可存"。
