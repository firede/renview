import type { Messages } from "../i18n";
import { INSTALL_CMD } from "../links";

/**
 * English copy, written as if the tool were designed in English from day one:
 * terse CLI style, no CJK punctuation, no literal translations of the Chinese phrasing.
 */
export const en: Messages = {
  cli: {
    help: `renview — a code review tool built to lower human cognitive load

Usage: renview [options]
       renview [options] diff [<git diff args>...]
       renview upgrade [version]

Commands:
  diff [args...]        Review Git changes (default with no command)
  upgrade [version]     Upgrade to the latest (or a specific) version

Options:
      --cwd <path>    Use a working directory (default: current directory)
      --port <port>   Use a specific local port (default: 17171, increments if busy)
      --no-open       Do not open the browser automatically
  -h, --help          Show this help
  -v, --version       Show version

--cwd, --port and --no-open may precede or follow diff; other diff arguments go to git diff. Arguments after -- are paths.
With no git diff arguments, shows working tree changes against HEAD (including untracked files).

Examples:
  renview                        Review uncommitted changes
  renview diff --staged          Review staged changes
  renview diff main...HEAD       Review a branch range
  renview diff HEAD~3 -- src/    Review a range, limited to given paths
  renview --cwd ../project       Review another repository
`,
    unknownCommand: (v) =>
      `Unknown command: ${v}.${v === "up" ? " Did you mean renview upgrade?" : " Use renview diff <args> to review Git changes."} See renview --help.`,
    unknownOption: (v) =>
      `Unknown option: ${v}. Git options go after renview diff. See renview --help.`,
    upgradeUsage: "Usage: renview upgrade [version]",
    missingCwd: "--cwd requires a directory path.",
    invalidCwd: (path) => `Cannot access directory: ${path}`,
    invalidPort: (v) => `Invalid port: ${v}`,
    notInRepo: "Not inside a git repository.",
    started: (url) => `renview started: ${url}`,
    repo: (root) => `Repository: ${root}`,
    configWarning: (path, w) => `Config ${path}: ${w}`,
    updateAvailable: (current, latest) =>
      `renview v${latest} is available (current: v${current}) — run: renview upgrade`,
    upgradeInvalidVersion: (v) => `Invalid version: ${v}`,
    upgradeFetchFailed:
      "Could not fetch the latest version; check your network (or the registry RENVIEW_REGISTRY points to)",
    upgradeUnknownInstall:
      "This renview binary was not installed via the install script or a package manager (possibly a dev build); please update it manually",
    upgradeAlreadyLatest: (v) => `Already up to date (v${v})`,
    upgradeViaScript: (v) => `Upgrading to v${v} via the install script…`,
    upgradeViaPm: (pm, v) => `Upgrading to v${v} via ${pm}…`,
    upgradeFailed: (d) => `Upgrade failed: ${d}`,
    upgradeManualHint: `Manual upgrade: ${INSTALL_CMD}`,
  },
  config: {
    tomlParseFailed: (d) => `Failed to parse TOML (${d}); using defaults`,
    fontFamilyNotString: (got) =>
      `font_family should be a string (got ${got}); using the default font`,
    fontSizeNotPositive: (got, fb) =>
      `font_size should be a positive number (got ${got}); using the default size ${fb}`,
    languageNotString: (got) =>
      `language should be a string (got ${got}); detecting language automatically`,
    languageUnsupported: (v) =>
      `language ${JSON.stringify(v)} matches no supported language (supported: zh-CN, en); detecting automatically`,
    updateCheckNotBoolean: (got) =>
      `update_check should be a boolean (got ${got}); using the default (on)`,
    themeUnsupported: (v) =>
      `theme should be one of auto, dark, light (got ${v}); following the system`,
  },
  api: {
    missingPath: "Missing path parameter",
    invalidPath: "Invalid path",
    fileNotFound: "File not found",
    notFound: "Not Found",
    gitDiffFailed: (d) => `git diff failed: ${d}`,
    gitLsFilesFailed: (d) => `git ls-files failed: ${d}`,
  },
  analysis: {
    anonymousName: "(anonymous)",
    unknownName: "(unknown)",
    commentChanges: "Comment changes",
    outsideDeclarations: "Changes outside declarations",
    truncatedSuffix: "… (truncated)",
    nameList: (shown, total) => `${shown}, … (${total} total)`,
    importsFold: (keyword, count, shown, hasMore) =>
      `${count} ${keyword}${count === 1 ? "" : "s"} (${shown.join(", ")}${hasMore ? ", …" : ""})`,
    typeSpecJoiner: "; ",
    foldedTypeMembers: (decl, members) =>
      members ? `${decl}: ${members} (type/format changes)` : `${decl} (type/format changes)`,
  },
};
