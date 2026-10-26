import { detectAgent, type DetectedAgent } from "./agent";

export interface Terminal {
  stdoutIsTty: boolean;
  stderrIsTty: boolean;
  columns: number;
  /** Colors on stdout: a TTY, and neither NO_COLOR nor TERM=dumb. */
  color: boolean;
  /** Colors on stderr, decided separately so `2>file` stays plain. */
  colorErr: boolean;
  agent: DetectedAgent | null;
}

const DEFAULT_COLUMNS = 100;

export function readTerminal(
  env: Readonly<Record<string, string | undefined>>,
  stdout: { isTTY?: boolean; columns?: number },
  stderr: { isTTY?: boolean }
): Terminal {
  const colorAllowed =
    (env["NO_COLOR"] ?? "") === "" &&
    env["TERM"] !== "dumb" &&
    env["FORCE_COLOR"] !== "0";
  const forced =
    (env["FORCE_COLOR"] ?? "") !== "" && env["FORCE_COLOR"] !== "0";
  const fromEnv = Number.parseInt(env["COLUMNS"] ?? "", 10);
  return {
    stdoutIsTty: stdout.isTTY === true,
    stderrIsTty: stderr.isTTY === true,
    columns:
      Number.isFinite(fromEnv) && fromEnv > 0
        ? fromEnv
        : stdout.columns && stdout.columns > 0
          ? stdout.columns
          : DEFAULT_COLUMNS,
    color: colorAllowed && (stdout.isTTY === true || forced),
    colorErr: colorAllowed && (stderr.isTTY === true || forced),
    agent: detectAgent(env),
  };
}
