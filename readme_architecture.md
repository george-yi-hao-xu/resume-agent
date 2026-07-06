# Step Architecture

本文档记录 Step 当前的 LLM 编辑链路，以及后续更稳妥的演进方向。

## 核心目标

系统的目标是把用户的自然语言编辑要求转换成可控、可验证、可回滚的页面修改。

核心原则：

- Node.js 后端负责上下文编排、LLM 调用、输出解析和安全边界。
- LLM 只负责生成候选编辑操作，不直接拥有最终 DOM 修改权。
- 前端只执行后端返回的结构化 patch，并返回执行结果。
- DOM 上下文按需传给 LLM，避免每次都塞入完整 DOM。

## 当前主链路

```text
Frontend
  -> sends instruction + resume summary + optional DOM + conversation history

Node.js backend
  -> decides whether to include full DOM
  -> builds LLM messages
  -> calls LLM provider
  -> parses and normalizes JSON patches
  -> returns validated patch-like operations

Frontend
  -> applies patches to preview DOM
  -> displays patch results to the user
```

当前 patch 模式对应接口：

```text
POST /api/llm/patches
```

请求主要包含：

- `instruction`: 用户的自然语言编辑要求。
- `resumeSummary` / `resumeStructure`: 简历的结构化摘要。
- `resumeDom`: 当前预览 DOM。
- `conversationHistory`: 最近对话上下文。
- `allowedCssCustomProperties`: 允许模型使用的 CSS 自定义属性白名单。

后端通过 `shouldIncludeFullDom` 判断这次请求是否需要把完整 DOM 放进 prompt。比如复制页面、翻译、结构复刻、选择器失败修复等场景，会更倾向于带完整 DOM。

## Patch 协议

当前 LLM 返回 JSON 数组，每个元素是一个 UI patch。主要 action 包括：

```ts
type UiPatch =
  | UpdateCssPatch
  | UpdateTextPatch
  | InsertHtmlPatch
  | RemoveElementPatch
  | SetSectionLayoutPatch
  | ClonePagePatch;
```

示例：

```json
[
  {
    "action": "update_text",
    "selector": ".resume-title",
    "text": "Full Stack Engineer"
  },
  {
    "action": "insert_html",
    "parent": ".skills-list",
    "position": "beforeend",
    "html": "<li>TypeScript</li>"
  }
]
```

当前 patch 使用 CSS selector 定位节点。这个方案实现简单，但长期有几个风险：

- selector 可能因为 DOM 结构变化而失效。
- LLM 可能生成过宽的 selector，影响多个非目标节点。
- 对复杂编辑来说，selector 不如稳定节点 id 可靠。

## 责任边界

### Frontend

前端负责：

- 收集用户输入。
- 提取 resume summary / DOM。
- 调用后端 LLM API。
- 对后端返回的 patch 执行确定性的 DOM 修改。
- 展示每个 patch 的执行结果。

前端不应该：

- 直接把用户输入拼成 prompt 调 LLM。
- 执行未经后端解析或校验的任意代码。
- 静默吞掉 patch 失败。

### Node.js Backend

后端负责：

- 判断是否需要完整 DOM。
- 组装 system prompt、用户指令和对话上下文。
- 调用 LLM provider。
- 从模型输出中提取 JSON patch。
- 规范化 action 名称和字段。
- 丢弃结构不合法的 patch。
- 记录 request id、模型、耗时、token 使用和原始输出。

后端是 LLM 输出进入系统的主要安全边界。后续更严格的校验也应该优先放在后端。

### LLM

LLM 负责：

- 理解用户意图。
- 根据 summary / DOM / conversation history 生成候选编辑操作。
- 返回结构化 JSON。

LLM 不负责：

- 直接修改真实 DOM。
- 决定哪些危险操作一定可以执行。
- 维护前端状态一致性。

## 后端校验建议

当前后端已经做了 JSON 提取、action 规范化和基本字段校验。后续建议把校验分成两层。

第一层是结构校验：

- 响应必须是 JSON 数组。
- `action` 必须在白名单内。
- 必填字段必须存在。
- 字段类型必须正确。
- `insert_html` 必须禁止 `script`、`iframe`、`object`、`embed`、inline event handler 和 `javascript:` URL。

第二层是语义校验：

- selector 必须命中允许修改的 resume 区域。
- selector 不应过宽，除非 action 明确允许多节点修改。
- 不允许删除 resume root、page root 或关键容器。
- CSS custom properties 必须在白名单内。
- layout action 只能使用支持的 section id。
- clone page 必须保留源页面结构，不能生成空容器替代非空容器。

## 前端执行建议

前端 patch engine 应该继续保持确定性：

- 不执行任意脚本。
- `insert_html` 先 sanitize 再插入。
- 每个 patch 单独返回成功或失败结果。
- patch 失败时返回明确原因。
- UI 中展示 patch 执行结果，方便用户理解发生了什么。

建议后续引入 revision：

```ts
type PatchEnvelope = {
  baseRevision: number;
  patches: UiPatch[];
};
```

前端只在当前 revision 和 `baseRevision` 一致时应用 patch。这样可以避免用户页面已经变化后，又应用旧请求返回的 patch。

## 推荐演进方向

### 1. 从完整 DOM 开关演进到 DOM 检索

当前逻辑是判断是否把完整 DOM 交给 LLM。后续可以改成 context builder：

```text
instruction + summary + relevant DOM slices + constraints -> LLM prompt
```

根据任务类型选择上下文：

- 简单文案修改：只带 summary。
- 修改某个 section：带该 section 的 DOM 子树。
- 翻译、复制、第二页：带源 page DOM。
- selector 修复：带失败 selector 附近的 DOM。
- 不确定目标：先让模型请求更多上下文，后端再补充。

这样可以减少 prompt 噪声和 token 成本，同时提高 selector 准确率。

### 2. 从 selector patch 演进到稳定 node id

更稳的方案是前端生成 DOM snapshot，每个可修改节点带稳定 id：

```ts
type DomSnapshotNode = {
  id: string;
  tag: string;
  role?: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: DomSnapshotNode[];
};
```

LLM 返回基于 `nodeId` 的操作：

```json
[
  {
    "op": "replaceText",
    "nodeId": "n_123",
    "value": "Full Stack Engineer"
  }
]
```

后端再把模型操作编译成前端 patch。这样比直接让 LLM 写 CSS selector 更稳定。

### 3. 引入中间操作协议

长期建议让 LLM 返回更语义化的中间协议，而不是直接返回前端 patch：

```text
LLM semantic ops -> backend validation -> frontend patch
```

好处：

- LLM 协议更小、更稳定。
- 后端可以集中做权限和语义校验。
- 前端 patch 格式可以独立演进。
- 日志和审计更容易读。

### 4. 优先修改页面模型，而不是直接修改 DOM

如果未来 resume preview 有明确的数据模型或组件 DSL，最好让 LLM 修改页面模型：

```text
LLM -> semantic ops -> resume model / component tree -> render DOM
```

直接 DOM patch 适合 MVP 和任意 HTML 编辑场景，但如果应用由我们完全控制，修改模型会更可靠、更容易测试，也更容易支持撤销、重做和版本管理。

## 推荐目标架构

```text
Frontend
  -> sends instruction + summary + DOM snapshot + revision

Node.js backend
  -> selects relevant context
  -> calls LLM
  -> validates structured semantic ops
  -> compiles semantic ops into frontend patches
  -> returns patch envelope with baseRevision

Frontend
  -> applies patches transactionally
  -> reports success/failure + new revision
```

关键边界不变：

```text
LLM generates candidate operations.
Node.js owns validation and safety.
Frontend performs deterministic DOM updates.
```

## Step 命名约定

这里的 step 指后端编辑工作流里的一个小步骤，不指 DOM node，也不指 Node.js。

```text
classify intent
  -> select context
  -> call LLM
  -> validate ops
  -> compile patches
  -> return envelope
```

每个 step 应该只负责一件事，读取共享的原始编辑状态，返回更新后的状态或下一步路由。这个命名借鉴 LangGraph 的 node 思路，但当前可以先用普通 TypeScript 函数实现，不急着引入图运行时。
