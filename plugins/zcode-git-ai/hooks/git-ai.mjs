import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const input = await readHookInput();
if (!input) process.exit(0);

const eventName = input.hook_event_name ?? input.hookEventName;
const sessionId = input.session_id ?? input.sessionId;
const toolName = input.tool_name ?? input.toolName;
const toolInput = input.tool_input ?? input.toolInput ?? {};
const cwd = input.cwd;

if (!eventName || !sessionId || !cwd) process.exit(0);

if (eventName === "SessionStart") {
  saveSessionModel(sessionId, input.model);
  process.exit(0);
}

const payload = buildCheckpointPayload({
  eventName,
  sessionId,
  toolName,
  toolInput,
  toolUseId: input.tool_use_id ?? input.toolUseId,
  cwd,
  model: input.model ?? loadSessionModel(sessionId)
});

if (!payload) process.exit(0);

const result = spawnSync(
  "git-ai",
  ["checkpoint", "agent-v1", "--hook-input", "stdin"],
  {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 12000,
    windowsHide: true
  }
);

// Tracking must never block the agent when git-ai is absent or a checkpoint fails.
if (result.error?.code === "ENOENT") process.exit(0);

if (result.error || result.status !== 0) {
  const detail = result.stderr?.trim() || result.error?.message || "unknown error";
  process.stderr.write(`[zcode-git-ai] checkpoint failed: ${detail}\n`);
}

async function readHookInput() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;

  try {
    return JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`[zcode-git-ai] invalid hook input: ${error.message}\n`);
    return null;
  }
}

function buildCheckpointPayload({
  eventName,
  sessionId,
  toolName,
  toolInput,
  toolUseId,
  cwd,
  model
}) {
  const agent = {
    repo_working_dir: cwd,
    agent_name: "zcode",
    model: model || "unknown",
    conversation_id: sessionId
  };

  if (toolName === "Write" || toolName === "Edit") {
    const filePath = toolInput.file_path ?? toolInput.filePath ?? toolInput.path;
    if (!filePath) return null;

    if (eventName === "PreToolUse") {
      return {
        type: "human",
        repo_working_dir: cwd,
        will_edit_filepaths: [filePath]
      };
    }

    if (eventName === "PostToolUse") {
      return {
        type: "ai_agent",
        ...agent,
        edited_filepaths: [filePath]
      };
    }
  }

  if (toolName === "Bash") {
    if (eventName === "PreToolUse") {
      return {
        type: "pre_shell_command",
        ...agent,
        tool_use_id: toolUseId,
        command: toolInput.command
      };
    }

    if (eventName === "PostToolUse") {
      return {
        type: "post_shell_command",
        ...agent,
        tool_use_id: toolUseId,
        command: toolInput.command
      };
    }
  }

  return null;
}

function saveSessionModel(sessionId, model) {
  if (!model) return;

  const path = sessionStatePath(sessionId);
  mkdirSync(sessionDataDir(), { recursive: true });
  writeFileSync(path, JSON.stringify({ model }), "utf8");
}

function loadSessionModel(sessionId) {
  try {
    return JSON.parse(readFileSync(sessionStatePath(sessionId), "utf8")).model;
  } catch {
    return "unknown";
  }
}

function sessionStatePath(sessionId) {
  const name = createHash("sha256").update(sessionId).digest("hex");
  return join(sessionDataDir(), `${name}.json`);
}

function sessionDataDir() {
  return (
    process.env.ZCODE_PLUGIN_DATA ??
    process.env.CLAUDE_PLUGIN_DATA ??
    join(tmpdir(), "zcode-git-ai")
  );
}
