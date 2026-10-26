import { Data } from "effect";
import { z } from "zod";
import type { PublicErrorCode } from "shared/public-api/common";

/** Process exit codes: scripts branch on these. */
export const EXIT = {
  ok: 0,
  /** Bad command, flags or option values. */
  usage: 1,
  /** Nothing to compare: unknown product, unresolved link, no offers. */
  nothing: 2,
  /** The service could not be reached or could not answer. */
  service: 3,
} as const;
export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export const exitCodeFor = (code: PublicErrorCode | "network") => {
  switch (code) {
    case "invalid_input":
    case "invalid_option":
      return EXIT.usage;
    case "not_found":
    case "product_not_found":
      return EXIT.nothing;
    case "comparison_unavailable":
    case "unavailable":
    case "rate_limited":
    case "network":
      return EXIT.service;
  }
};

/** What `--json` prints when the failure did not come from the API itself. */
export const localErrorBody = (
  code: PublicErrorCode | "network",
  message: string
) => ({
  ok: false as const,
  error: {
    code,
    message,
    retryable: code === "network" || code === "rate_limited",
  },
});

export const jsonValueSchema = z.json();
export type JsonValue = z.infer<typeof jsonValueSchema>;

/**
 * Every expected way a command ends early. `body` is the JSON a script sees on
 * stdout in machine mode; `message` and `hint` are the human lines on stderr.
 * Exit code 0 stops quietly (for `--dry-run`).
 */
export class CliFailure extends Data.TaggedError("CliFailure")<{
  readonly exitCode: ExitCode;
  readonly message: string;
  readonly hint?: string;
  readonly body?: JsonValue;
  /** Extra lines printed after the message, such as a list of matches. */
  readonly details?: readonly string[];
}> {}

export const usageFailure = (message: string, hint?: string) =>
  new CliFailure({
    exitCode: EXIT.usage,
    message,
    hint,
    body: localErrorBody("invalid_input", message),
  });

export const nothingFailure = (
  message: string,
  options: { hint?: string; details?: readonly string[]; body?: JsonValue } = {}
) =>
  new CliFailure({
    exitCode: EXIT.nothing,
    message,
    hint: options.hint,
    details: options.details,
    body: options.body ?? localErrorBody("not_found", message),
  });

/** Stops the command without an error, after `--dry-run` printed its request. */
export const stopQuietly = () =>
  new CliFailure({ exitCode: EXIT.ok, message: "" });

/** The local error body for a failure with no API answer, by exit code. */
export const bodyForExit = (exitCode: number, message: string) =>
  localErrorBody(
    exitCode === EXIT.nothing
      ? "not_found"
      : exitCode === EXIT.service
        ? "unavailable"
        : "invalid_input",
    message
  );

/** Output for scripts and agents: `--json`, or a pipe or agent unless `--table`. */
export const machineOutput = (
  argv: readonly string[],
  terminal: { stdoutIsTty: boolean; agent: unknown }
) =>
  argv.includes("--json") ||
  (!argv.includes("--table") &&
    (!terminal.stdoutIsTty || terminal.agent !== null));
