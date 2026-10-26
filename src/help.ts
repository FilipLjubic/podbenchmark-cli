import { CliOutput } from "effect/cli";
import type { Terminal } from "./terminal";
import { makeStyle } from "./style";
import { bodyForExit, EXIT, machineOutput } from "./failure";

const AGENT_NOTES = [
  "Use --json (it is on automatically here) and read the fields; null means unknown, never 0.",
  "Flow: search → options → compare. Take option values from `options`; never guess a size or color.",
  "`--schema` prints the exact input and output fields of any command.",
  "`skills add` installs these instructions for your agent.",
];

export const agentBlock = (terminal: Terminal) => {
  if (!terminal.agent) return "";
  const style = makeStyle(terminal.color);
  return `${style.bold("AGENTS:")}\n${AGENT_NOTES.map(note => `  ${note}`).join("\n")}\n\n`;
};

const SUBCOMMAND = /^[a-z][a-z-]*$/;

/**
 * Parse mistakes get one line and a pointer to `--help`, not the whole help
 * page. `knownCommands` lets the pointer name the command the person was using.
 */
export function makeFormatter(
  terminal: Terminal,
  argv: readonly string[],
  knownCommands: ReadonlySet<string>
): CliOutput.Formatter {
  const base = CliOutput.defaultFormatter({ colors: terminal.color });
  const helpWanted = argv.includes("--help") || argv.includes("-h");
  const style = makeStyle(terminal.colorErr);
  const commandPath = () => {
    const words = argv.filter(token => SUBCOMMAND.test(token));
    const first = words[0];
    if (first === undefined || !knownCommands.has(first)) return "podbenchmark";
    const second = words[1];
    return second !== undefined &&
      (first === "config" || first === "skills") &&
      knownCommands.has(`${first} ${second}`)
      ? `podbenchmark ${first} ${second}`
      : `podbenchmark ${first}`;
  };
  return {
    ...base,
    formatHelpDoc: doc =>
      // A help page that follows a parse error is replaced by formatErrors.
      helpWanted ? agentBlock(terminal) + base.formatHelpDoc(doc) : "",
    formatErrors: errors => {
      const first = errors[0];
      if (!first) return "";
      const [message = "", ...rest] = first.message
        .split("\n")
        .filter(line => line.trim() !== "");
      const cleaned = message
        .replace(/ in command .*$/, "")
        .replace(/^Unknown subcommand "([^"]*)".*$/, 'Unknown command "$1".');
      const suggestion = rest.at(-1)?.trim();
      const text = `${cleaned}${suggestion && rest.length > 1 ? ` Did you mean ${suggestion}?` : ""}`;
      if (machineOutput(argv, terminal))
        process.stdout.write(
          `${JSON.stringify(bodyForExit(EXIT.usage, text), null, 2)}\n`
        );
      const lines = [
        `${style.red("error:")} ${cleaned}${suggestion && rest.length > 1 ? ` Did you mean ${suggestion}?` : ""}`,
        style.dim(`Run ${commandPath()} --help for the flags.`),
      ];
      return lines.join("\n");
    },
  };
}
