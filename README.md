# Z Code Git AI

通过 Z Code Hooks 将 Agent 产生的代码修改记录到 [Git AI](https://github.com/git-ai-project/git-ai)，为 Git 提交提供行级 AI 归因。

## 功能

- 记录 Z Code `Write`、`Edit` 工具产生的文件修改
- 记录 Z Code `Bash` 命令产生的文件修改
- 在 AI 编辑前保存人类修改基线，避免把已有的未提交修改误标为 AI
- 记录 Z Code Session、Agent 名称和模型名称
- 未安装 Git AI 或 checkpoint 执行失败时，不阻塞 Z Code
- 无 npm 运行时依赖

## 前置条件

安装 Git AI，并确保 `git-ai` 可以从终端直接运行：

```sh
git-ai --version
```

安装 Git AI 后如果 Z Code 已经在运行，请重启 Z Code，使其获得更新后的 `PATH`。

## 从 Marketplace 安装

1. 在 Z Code 中打开一个工作区。
2. 进入 **设置 → 插件管理 → Marketplace**。
3. 点击搜索框旁边的 **+**。
4. 添加 Marketplace 来源：

   ```text
   wyw5257997/zcode-git-ai
   ```

   也可以填写完整地址：

   ```text
   https://github.com/wyw5257997/zcode-git-ai
   ```

5. 找到 `zcode-git-ai`，点击 **获取** 并确认插件已启用。
6. 新建 Z Code Session。Hook 配置在 Session 启动时形成快照，已经打开的 Session 不会自动加载新插件。

## 验证

让 Z Code 修改 Git 仓库中的文件，然后提交：

```sh
git add .
git commit -m "test zcode git-ai integration"
git log --show-notes=ai -1
git ai stats --json
```

提交与 Z Code Session 的 AI 归因应当出现在 Git Note 和统计结果中。

## 工作原理

| Z Code Hook | Git AI checkpoint |
| --- | --- |
| `PreToolUse: Write/Edit` | `human`，保存编辑前的人类修改基线 |
| `PostToolUse: Write/Edit` | `ai_agent`，记录 AI 修改后的文件 |
| `PreToolUse: Bash` | `pre_shell_command`，保存命令执行前状态 |
| `PostToolUse: Bash` | `post_shell_command`，记录命令产生的修改 |

Z Code 和 Git AI 使用不同的 Hook JSON 格式。`hooks/git-ai.mjs` 负责把 Z Code Hook 输入转换为 Git AI 的 `agent-v1` checkpoint 格式，并同步调用本机的 `git-ai`。

## 当前限制

- Git AI 当前的通用 `agent-v1` preset 不读取 Z Code 的完整 transcript，因此本插件目前提供代码、Agent、模型和 Session 归因，不提供完整 Prompt 内容关联。
- 如果 Z Code 没有在 `SessionStart` 或工具事件中提供模型名，模型会记录为 `unknown`。
- 只有通过 `Write`、`Edit` 或 `Bash` 工具产生的修改会被记录。

## 安全说明

插件只在本机执行以下命令，并通过 stdin 传递 checkpoint JSON：

```text
git-ai checkpoint agent-v1 --hook-input stdin
```

插件不会上传代码，也不会自行提交或推送 Git 仓库。Git AI 自身的数据行为以其项目文档和本机配置为准。

## 参考文档

- [Z Code Hooks](https://zcode.z.ai/cn/docs/hooks)
- [Z Code Plugin](https://zcode.z.ai/cn/docs/plugin)
- [Git AI：Add a coding agent](https://usegitai.com/docs/agents/add-your-agent)
