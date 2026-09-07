import pkg from "../package.json";
import type { Messages } from "./i18n";

interface CliOptions {
  port?: number;
  cwd?: string;
  open: boolean;
  gitArgs: string[];
}

export function parseArgs(argv: string[], m: Messages): CliOptions {
  const gitArgs: string[] = [];
  let port: number | undefined;
  let open = true;
  let cwd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      gitArgs.push(...argv.slice(i));
      break;
    }
    if (a === "-C" || a === "--cwd" || a?.startsWith("--cwd=")) {
      const value = a.startsWith("--cwd=") ? a.slice(6) : argv[++i];
      if (!value || (!a.startsWith("--cwd=") && value.startsWith("-"))) {
        console.error(m.cli.missingCwd);
        process.exit(1);
      }
      cwd = value;
    } else if (a === "-p" || a === "--port") {
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
      gitArgs.push(a);
    }
  }
  return { port, open, gitArgs, cwd };
}
