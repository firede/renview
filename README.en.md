# renview

[中文](README.md) · [Website](https://view.bandwidth.ren)

Read agent-written code with your attention on the business model, interfaces, and key flows.

renview opens Git changes in a local browser and folds away language details such as type annotations, making the changes that matter easier to follow.

- **Simplified review**: read a continuous flow of code with changes to parameters, model members, and implementation highlighted.
- **Originals within reach**: hover to reveal simplified fragments, expand folds and surrounding context, or switch to the raw diff.
- **Source browsing**: explore repository files in the same simplified view and navigate by declaration outline.

Code analysis runs locally and requires no LLM. The simplified view helps you understand the code; the original is always available.

## Installation

Use the install script (run it in Git Bash on Windows):

```bash
curl -fsSL https://view.bandwidth.ren/install | bash
```

Or install with npm:

```bash
npm install -g renview
```

Available for macOS, Linux (glibc), and Windows, on both x64 and arm64.

Upgrade to the latest version:

```bash
renview upgrade
```

## Usage

Run inside a Git repository to open the review in your browser:

```bash
renview
```

By default, renview shows all uncommitted changes, including staged changes, unstaged changes, and untracked files.

| Task                                                            | Command                         |
| --------------------------------------------------------------- | ------------------------------- |
| Review staged changes only                                      | `renview diff --staged`         |
| Review branch changes since the common ancestor                 | `renview diff main...HEAD`      |
| Compare the working tree with three commits ago, limited to src | `renview diff HEAD~3 -- src/`   |
| Use another repository                                          | `renview -C ../project`         |
| Set the port without opening a browser                          | `renview --port 8080 --no-open` |

`renview` is equivalent to `renview diff`. Put tool options (`--port`, `--no-open`, `-C`) before the command. Arguments after `diff` are passed unchanged to `git diff`, with `--` separating paths. Add `diff` to older commands such as `renview main...HEAD` and `renview --staged`; use `--port` instead of `-p` for the port.

Staged and commit-range reviews exclude working-tree drafts. Revision and path arguments follow `git diff`; run `renview --help` for tool options.

The interface opens in **Changes** mode, where you can switch between simplified and raw diffs and expand unchanged context as needed. **Browse** mode lets you read repository files.

- **Code simplification**: TypeScript, JavaScript, TSX, JSX, Java, Rust, Go, Python, GDScript.
- **Syntax highlighting**: TypeScript, JavaScript, TSX, JSX, Java, Rust, Go, Python, GDScript, XML, Groovy, Gradle, Kotlin, Kotlin DSL, Properties, Bash, Batch, JSON, JSONC, JSON5, JSONL, TOML, YAML, Markdown, CSS, SCSS, Sass, Less.

## Configuration

No configuration is required. The interface language and theme follow your system by default. To customize them, create `~/.config/renview/config.toml`. If `XDG_CONFIG_HOME` is set, use `renview/config.toml` under that directory. On Windows, use `%APPDATA%\renview\config.toml`.

```toml
language = "en"
theme = "light"
font_family = "JetBrains Mono, Sarasa Mono SC"
font_size = 13
update_check = false
```

| Option         | Description                     | Default               |
| -------------- | ------------------------------- | --------------------- |
| `language`     | `zh-CN` or `en`                 | Automatic detection   |
| `theme`        | `auto`, `light`, or `dark`      | `auto`                |
| `font_family`  | Font names, separated by commas | System monospace font |
| `font_size`    | Code font size in pixels        | `12`                  |
| `update_check` | Check for updates on startup    | `true`                |

After saving interface settings, refocus the window to apply them.

## Development

Requires Bun. The first build of the GDScript parser also requires Docker to be running.

```bash
bun install
bun run dev diff HEAD~5
```

Open the URL printed in the terminal to view the development server.

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `bun run test`      | Prepare build assets and run all tests     |
| `bun run typecheck` | Check types                                |
| `bun run build`     | Build binaries for all platforms into dist |
| `bun run gen:demo`  | Update the website demo data               |

See [AGENTS.md](AGENTS.md) for development conventions and [product decisions](.agents/truth/product.md) for product tradeoffs (both in Chinese).
