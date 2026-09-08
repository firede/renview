import pkg from "../package.json";
import type { Messages } from "./i18n";

interface CliOptions {
  command: "diff" | "upgrade";
  version?: string;
  port?: number;
  cwd?: string;
  open: boolean;
  gitArgs: string[];
}

export function parseArgs(argv: string[], m: Messages): CliOptions {
  let gitArgs: string[] = [];
  let command: CliOptions["command"] = "diff";
  let version: string | undefined;
  let port: number | undefined;
  let open = true;
  let cwd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "diff") {
      // 子命令后完整交给 Git，保留其选项和路径分隔符语义。
      gitArgs = argv.slice(i + 1);
      break;
    }
    if (a === "upgrade") {
      command = "upgrade";
      const args = argv.slice(i + 1);
      if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
        console.log(m.cli.help);
        process.exit(0);
      }
      if (args.length > 1) throw new Error(m.cli.upgradeUsage);
      version = args[0];
      break;
    }
    if (a === "-C" || a === "--cwd" || a?.startsWith("--cwd=")) {
      const value = a.startsWith("--cwd=") ? a.slice(6) : argv[++i];
      if (!value || (!a.startsWith("--cwd=") && value.startsWith("-"))) {
        console.error(m.cli.missingCwd);
        process.exit(1);
      }
      cwd = value;
    } else if (a === "--port") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v <= 0 || v > 65535) {
        console.error(m.cli.invalidPort(argv[i]!));
        process.exit(1);
      }
      port = v;
    } else if (a === "--no-open") {
      open = false;
    } else if (a === "-h" || a === "--help") {
      console.log(m.cli.help);
      process.exit(0);
    } else if (a === "-v" || a === "--version") {
      console.log(pkg.version);
      process.exit(0);
    } else {
      throw new Error(a.startsWith("-") ? m.cli.unknownOption(a) : m.cli.unknownCommand(a));
    }
  }
  return { command, version, port, open, gitArgs, cwd };
}
