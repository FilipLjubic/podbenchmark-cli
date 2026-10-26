/**
 * Which agent harness, if any, launched this process. Mirrors the environment
 * signals the Cloudflare `cf` CLI reads, so the same variables mean the same
 * thing across tools.
 */
export interface DetectedAgent {
  /** Stable id sent as `X-Podbenchmark-Agent`. */
  id: string;
  name: string;
}

type Env = Readonly<Record<string, string | undefined>>;

const OFF_VALUES = new Set(["", "0", "false", "no", "off"]);

/** A variable counts as set only when it holds a real value. */
const present = (env: Env, key: string) => {
  const value = env[key]?.trim();
  return value !== undefined && !OFF_VALUES.has(value.toLowerCase())
    ? value
    : undefined;
};
const is = (env: Env, key: string, expected: string) => env[key] === expected;

const NAMES_BY_AI_AGENT: Readonly<Record<string, DetectedAgent>> = {
  pi: { id: "pi", name: "Pi" },
  crush: { id: "crush", name: "Crush" },
  github_copilot_vscode_agent: {
    id: "vscode-copilot-agent",
    name: "GitHub Copilot in VS Code",
  },
};

const DETECTORS: readonly ((env: Env) => DetectedAgent | null)[] = [
  env =>
    is(env, "OPENCODE", "1") ? { id: "opencode", name: "OpenCode" } : null,
  env =>
    present(env, "QWEN_CODE_SESSION_ID")
      ? { id: "qwen-code", name: "Qwen Code" }
      : null,
  env => (is(env, "PI_CODING_AGENT", "true") ? { id: "pi", name: "Pi" } : null),
  env =>
    is(env, "CURSOR_AGENT", "1")
      ? { id: "cursor-agent", name: "Cursor Agent" }
      : null,
  env =>
    is(env, "CLAUDECODE", "1")
      ? { id: "claude-code", name: "Claude Code" }
      : null,
  env =>
    present(env, "CODEX_THREAD_ID")
      ? { id: "codex", name: "OpenAI Codex" }
      : null,
  env =>
    present(env, "AMP_CURRENT_THREAD_ID") ? { id: "amp", name: "Amp" } : null,
  env =>
    is(env, "GEMINI_CLI", "1")
      ? { id: "gemini-agent", name: "Gemini CLI" }
      : null,
  env =>
    is(env, "AUGMENT_AGENT", "1") ? { id: "auggie", name: "Auggie" } : null,
  env => (is(env, "CRUSH", "1") ? { id: "crush", name: "Crush" } : null),
  env =>
    is(env, "COPILOT_AGENT", "1")
      ? {
          id: "vscode-copilot-agent",
          name: "GitHub Copilot in VS Code",
        }
      : null,
  env => (present(env, "OZ_RUN_ID") ? { id: "warp", name: "Warp" } : null),
  // `AI_AGENT=<name>` is the cross-tool convention; keep it last so the
  // harness-specific variables above name the agent more precisely.
  env => {
    const value = present(env, "AI_AGENT");
    if (value === undefined) return null;
    return (
      NAMES_BY_AI_AGENT[value.toLowerCase()] ?? {
        id: value
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "-")
          .slice(0, 40),
        name: value,
      }
    );
  },
];

export function detectAgent(env: Env): DetectedAgent | null {
  for (const detect of DETECTORS) {
    const agent = detect(env);
    if (agent) return agent;
  }
  return null;
}
