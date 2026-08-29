# Step Architecture

本文档记录 Step 当前的 LLM 编辑链路，以及后续更稳妥的演进方向。

## 核心目标

系统的目标是把用户的自然语言编辑要求转换成可控、可验证、可回滚的页面修改。

核心原则：

- Node.js 后端负责上下文编排、LLM 调用、输出解析和安全边界。
- LLM 只负责生成候选编辑操作，不直接拥有最终 DOM 修改权。
- 前端只执行后端返回的结构化 resume diff，并返回执行结果。
- DOM 上下文按需传给 LLM，避免每次都塞入完整 DOM。

## 当前主链路

```text
Frontend
  -> sends instruction + resume summary + optional DOM + conversation history

Node.js backend
  -> classifies intent
  -> selects relevant resume nodes
  -> builds LLM messages
  -> calls LLM provider
  -> parses JSON Patch-style resume diffs
  -> validates diff paths against the resume wd index
  -> returns validated diffs

Frontend
  -> applies diffs to the resume model
  -> renders the updated preview
  -> displays operation results to the user
```

当前 LLM 编辑接口：

```text
POST /api/llm/resume-diff
```

请求主要包含：

- `instruction`: 用户的自然语言编辑要求。
- `resumeSummary` / `resumeStructure`: 简历的结构化摘要。
- `resumeDom`: 当前预览 DOM。
- `conversationHistory`: 最近对话上下文。
- `allowClassNames`: 允许模型参考的 class 名称。

旧的 selector-based `patch-generator` 已移除。后端现在只通过 `resume-diff-generator` 生成 JSON Patch-style 操作，优先修改 resume model，再由前端重新渲染预览。

## Resume Diff 协议

当前 LLM 返回 JSON 对象，`diffs` 内每个元素是一个 JSON Patch-style resume diff。主要 op 包括：

```ts
type ResumeDiffOp =
	| { op: "add"; path: string; value: ResumeJsonPatchValue }
	| { op: "replace"; path: string; value: ResumeJsonPatchValue }
	| { op: "remove"; path: string }
	| { op: "move"; from: string; path: string }
	| { op: "copy"; from: string; path: string }
	| { op: "test"; path: string; value: ResumeJsonPatchValue };
```

示例：

```json
{
	"diffs": [
		{
			"op": "replace",
			"path": "/tree/root/children/0/children/0/value",
			"value": "Full Stack Engineer"
		}
	]
}
```

当前 diff 使用 resume `wd` 路径定位节点。相比旧 selector patch，它更适合前端受控渲染和路径校验：

- 后端可以校验目标路径是否存在于当前 resume。
- 前端可以对 resume model 做事务式应用，失败时回滚。
- 同一份数据模型可以支持撤销、重做、保存和重新渲染。

## 责任边界

### Frontend

前端负责：

- 收集用户输入。
- 提取 resume summary / DOM。
- 调用后端 LLM API。
- 对后端返回的 diff 执行确定性的 model 修改。
- 展示每个 diff 的执行结果。

前端不应该：

- 直接把用户输入拼成 prompt 调 LLM。
- 执行未经后端解析或校验的任意代码。
- 静默吞掉 diff 失败。

### Node.js Backend

后端负责：

- 分类用户意图。
- 选择相关 resume 节点。
- 组装 system prompt、用户指令和对话上下文。
- 调用 LLM provider。
- 从模型输出中提取 JSON diff。
- 规范化 op 名称和字段。
- 丢弃结构不合法的 diff。
- 校验 diff path 是否在允许的 resume `wd` 路径内。
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

当前后端已经做了 JSON 提取、op 规范化、基本字段校验和 resume path 校验。后续建议把校验继续分成两层。

第一层是结构校验：

- 响应必须包含 diff 数组。
- `op` 必须在白名单内。
- 必填字段必须存在。
- 字段类型必须正确。
- diff value 必须是 JSON-serializable。

第二层是语义校验：

- replace/remove/test 必须指向当前 resume 中存在的 `wd` path。
- copy/move 的 `from` 必须存在。
- 不允许替换或删除 root object。
- 不允许创建 `script`、`style`、`iframe`、`object`、`embed` 节点、event attrs 或 `javascript:` URL。
- 复制页面时应复制已有 page subtree，再替换复制页中的文本字段。

## 前端执行建议

前端 diff engine 应该继续保持确定性：

- 不执行任意脚本。
- 每个 diff 单独返回成功或失败结果。
- 任意 diff 失败或结果不是合法 resume 时回滚整次编辑。
- UI 中展示 diff 执行结果，方便用户理解发生了什么。

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
- path 修复：带失败 path 附近的 resume 节点。
- 不确定目标：先让模型请求更多上下文，后端再补充。

这样可以减少 prompt 噪声和 token 成本，同时提高 path 准确率。

### 2. 继续强化稳定 node id / wd path

当前 resume model 已经带 `wd` 路径。后续可以继续强化 path 稳定性，每个可修改节点都保留稳定 id：

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

LLM 返回基于稳定 path 或 `nodeId` 的操作：

```json
[
	{
		"op": "replaceText",
		"nodeId": "n_123",
		"value": "Full Stack Engineer"
	}
]
```

后端校验模型操作，再交给前端 diff engine 应用。这样比直接让 LLM 写 CSS selector 更稳定。

### 3. 引入中间操作协议

长期可以让 LLM 返回更语义化的中间协议，而不是直接返回低层 JSON Patch：

```text
LLM semantic ops -> backend validation -> resume diff
```

好处：

- LLM 协议更小、更稳定。
- 后端可以集中做权限和语义校验。
- 前端 diff engine 可以保持小而确定。
- 日志和审计更容易读。

### 4. 优先修改页面模型，而不是直接修改 DOM

如果未来 resume preview 有明确的数据模型或组件 DSL，最好让 LLM 修改页面模型：

```text
LLM -> semantic ops -> resume model / component tree -> render DOM
```

直接 DOM patch 已经不再作为 LLM 编辑主路径。如果应用由我们完全控制，修改模型会更可靠、更容易测试，也更容易支持撤销、重做和版本管理。

## 推荐目标架构

```text
Frontend
  -> sends instruction + summary + DOM snapshot + revision

Node.js backend
  -> selects relevant context
  -> calls LLM
  -> validates structured resume diffs
  -> returns diff envelope with baseRevision

Frontend
  -> applies diffs transactionally
  -> reports success/failure + new revision
```

关键边界不变：

```text
LLM generates candidate operations.
Node.js owns validation and safety.
Frontend performs deterministic model updates.
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
