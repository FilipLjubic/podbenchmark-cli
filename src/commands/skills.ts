import { Console, Effect, FileSystem, Option, Path } from "effect";
import { Command, Flag } from "effect/cli";
import { homedir } from "node:os";
import { z } from "zod";
import { CliFailure, EXIT, usageFailure } from "../failure";
import { printJson, withSession, type Session } from "../session";
import { SKILL_MARKER, SKILL_NAME, skillText } from "../skill-text";
import type { DetectedAgent } from "../agent";

const AGENTS = ["claude", "codex", "opencode", "cursor"] as const;
type Agent = (typeof AGENTS)[number];
const agentChoice = z.enum([...AGENTS, "all"]);

/** Where each agent reads personal and project skills (checked against each agent's docs, October 2026). */
const SKILL_ROOTS = {
  claude: {
    personal: [".claude", "skills"],
    project: [".claude", "skills"],
    marker: [".claude"],
  },
  codex: {
    personal: [".agents", "skills"],
    project: [".agents", "skills"],
    marker: [".codex", ".agents"],
  },
  opencode: {
    personal: [".config", "opencode", "skills"],
    project: [".opencode", "skills"],
    // One path: a bare ~/.config says nothing about OpenCode.
    marker: [".config/opencode"],
  },
  cursor: {
    personal: [".cursor", "skills"],
    project: [".cursor", "skills"],
    marker: [".cursor"],
  },
} as const satisfies Record<Agent, unknown>;

const AGENT_FOR_HARNESS: Readonly<Record<string, Agent>> = {
  "claude-code": "claude",
  codex: "codex",
  opencode: "opencode",
  "cursor-agent": "cursor",
};

type Outcome = {
  agent: Agent;
  path: string;
  result: "written" | "updated" | "unchanged" | "skipped";
};

const write = (agent: Agent, file: string, content: string, force: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const exists = yield* fs.exists(file);
    if (exists) {
      const current = yield* fs.readFileString(file);
      if (current === content)
        return { agent, path: file, result: "unchanged" } satisfies Outcome;
      if (!current.includes(SKILL_MARKER) && !force) {
        return { agent, path: file, result: "skipped" } satisfies Outcome;
      }
    }
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);
    return {
      agent,
      path: file,
      result: exists ? "updated" : "written",
    } satisfies Outcome;
  });

const chooseAgents = (
  requested: string | undefined,
  detected: DetectedAgent | null,
  home: string
) =>
  Effect.gen(function* () {
    if (requested !== undefined) {
      const parsed = agentChoice.safeParse(requested.toLowerCase());
      if (!parsed.success) {
        return yield* usageFailure(
          `--agent ${JSON.stringify(requested)} is not one of ${[...AGENTS, "all"].join(", ")}.`
        );
      }
      return parsed.data === "all" ? [...AGENTS] : [parsed.data];
    }
    const fromHarness = detected ? AGENT_FOR_HARNESS[detected.id] : undefined;
    if (fromHarness) return [fromHarness];
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const installed: Agent[] = [];
    for (const agent of AGENTS) {
      for (const marker of SKILL_ROOTS[agent].marker) {
        const found = yield* fs
          .exists(path.join(home, marker))
          .pipe(Effect.orElseSucceed(() => false));
        if (found) {
          installed.push(agent);
          break;
        }
      }
    }
    if (installed.length === 0) {
      return yield* usageFailure(
        "No agent found on this machine.",
        "Say which one: podbenchmark skills add --agent claude|codex|opencode|cursor|all"
      );
    }
    return installed;
  });

function report(session: Session, outcomes: readonly Outcome[]) {
  const { style } = session;
  const verbs = {
    written: style.green("wrote"),
    updated: style.green("updated"),
    unchanged: style.dim("unchanged"),
    skipped: style.yellow(
      "skipped (not written by podbenchmark; use --force to replace)"
    ),
  } as const;
  return outcomes
    .map(outcome => `${verbs[outcome.result]} ${outcome.path}`)
    .join("\n");
}

const addCommand = Command.make(
  "add",
  {
    agent: Flag.String("agent").pipe(
      Flag.withDescription(
        "claude, codex, opencode, cursor or all (default: the agent you are in, else every one installed here)."
      ),
      Flag.optional
    ),
    project: Flag.Boolean("project").pipe(
      Flag.withDescription(
        "Write into the current directory's skills folders instead of your personal ones."
      ),
      Flag.withDefault(false)
    ),
    force: Flag.Boolean("force").pipe(
      Flag.withDescription(
        "Replace a skill file that podbenchmark did not write."
      ),
      Flag.withDefault(false)
    ),
  },
  config =>
    withSession(session =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const home = homedir();
        const requested = Option.getOrUndefined(config.agent);
        const agents = yield* chooseAgents(
          requested,
          session.terminal.agent,
          home
        );
        const base = config.project ? process.cwd() : home;
        const content = skillText();
        const outcomes: Outcome[] = [];
        for (const agent of agents) {
          const roots = SKILL_ROOTS[agent];
          const folder = path.join(
            base,
            ...(config.project ? roots.project : roots.personal),
            SKILL_NAME
          );
          outcomes.push(
            yield* write(
              agent,
              path.join(folder, "SKILL.md"),
              content,
              config.force
            ).pipe(
              Effect.mapError(
                () =>
                  new CliFailure({
                    exitCode: EXIT.usage,
                    message: `Could not write the skill for ${agent} under ${folder}.`,
                    hint: "Check that the folder is writable.",
                  })
              )
            )
          );
        }
        if (session.machine) {
          yield* printJson({ ok: true, files: outcomes });
        } else {
          yield* Console.log(report(session, outcomes));
          yield* Console.log(
            session.style.dim(
              "Agents load it by name: podbenchmark. Start a new session to pick it up."
            )
          );
        }
        if (outcomes.some(outcome => outcome.result === "skipped")) {
          return yield* new CliFailure({ exitCode: EXIT.usage, message: "" });
        }
      })
    )
).pipe(
  Command.withDescription(
    "Teach your coding agent the search → options → compare flow by installing a podbenchmark skill."
  ),
  Command.withExamples([
    { command: "podbenchmark skills add --agent claude" },
    {
      command: "podbenchmark skills add --agent all --project",
      description: "Commit the skill with your repository",
    },
  ])
);

export const skillsCommand = Command.make("skills").pipe(
  Command.withDescription(
    "Install podbenchmark instructions for AI coding agents."
  ),
  Command.withSubcommands([addCommand])
);
