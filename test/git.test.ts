import { afterAll, describe, expect, test } from "bun:test";
import { $ } from "bun";
import * as fs from "node:fs";
import * as os from "node:os";
import { join } from "node:path";
import { EMPTY_TREE, getReviewDiff, getSideContent, listFiles, listUntracked, extractPathspecs, resolveDiffArgs, resolveSides, type SideSpec } from "../src/git";

const tmpdirs: string[] = [];

/** 建一个临时 git 仓库；withCommit 为 true 时在 main 上有一个初始提交 */
async function makeRepo(withCommit: boolean): Promise<string> {
  const dir = fs.mkdtempSync(join(os.tmpdir(), "renview-git-test-"));
  tmpdirs.push(dir);
  await $`git init -q -b main ${dir}`.quiet();
  await $`git -C ${dir} config user.email test@example.com`.quiet();
  await $`git -C ${dir} config user.name Test`.quiet();
  if (withCommit) await commitFile(dir, "a.txt", "hello\n", "init");
  return dir;
}

async function commitFile(dir: string, name: string, content: string, msg: string): Promise<void> {
  fs.writeFileSync(join(dir, name), content);
  await $`git -C ${dir} add ${name}`.quiet();
  await $`git -C ${dir} commit -qm ${msg}`.quiet();
}

async function revParse(dir: string, rev: string): Promise<string> {
  return (await $`git -C ${dir} rev-parse ${rev}`.quiet().text()).trim();
}

/** 构造 main 与 feat 从初始提交分叉、各有一个提交的仓库，返回共同祖先（初始提交）的 hash */
async function makeDivergedRepo(): Promise<{ dir: string; base: string }> {
  const dir = await makeRepo(true);
  const base = await revParse(dir, "HEAD");
  await $`git -C ${dir} checkout -qb feat`.quiet();
  await commitFile(dir, "feat.txt", "feat\n", "feat commit");
  await $`git -C ${dir} checkout -q main`.quiet();
  await commitFile(dir, "main.txt", "main\n", "main commit");
  return { dir, base };
}

afterAll(() => {
  for (const d of tmpdirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("extractPathspecs", () => {
  test("无 -- 时返回空数组", () => {
    expect(extractPathspecs([])).toEqual([]);
    expect(extractPathspecs(["--staged", "HEAD~1"])).toEqual([]);
  });

  test("返回 -- 之后的所有元素", () => {
    expect(extractPathspecs(["HEAD~1", "--", "src/", "README.md"])).toEqual([
      "src/",
      "README.md",
    ]);
  });

  test("-- 为空尾时返回空数组", () => {
    expect(extractPathspecs(["HEAD~1", "--"])).toEqual([]);
  });
});

describe("resolveDiffArgs", () => {
  test("参数非空时原样返回", async () => {
    const dir = await makeRepo(true);
    const args = ["--staged", "--", "src/"];
    expect(await resolveDiffArgs(dir, args)).toEqual(args);
  });

  test("无参且有提交时默认对比 HEAD", async () => {
    const dir = await makeRepo(true);
    expect(await resolveDiffArgs(dir, [])).toEqual(["HEAD"]);
  });

  test("无参且无提交时默认对比空树", async () => {
    const dir = await makeRepo(false);
    expect(await resolveDiffArgs(dir, [])).toEqual([EMPTY_TREE]);
  });
});

describe("resolveSides", () => {
  test("无参数：暂存区 vs 工作区", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, [])).toEqual({
      oldSide: { type: "index" },
      newSide: { type: "worktree" },
    });
  });

  test("--staged 与 --cached：HEAD vs 暂存区", async () => {
    const dir = await makeRepo(true);
    const expected: { oldSide: SideSpec; newSide: SideSpec } = {
      oldSide: { type: "rev", rev: "HEAD" },
      newSide: { type: "index" },
    };
    expect(await resolveSides(dir, ["--staged"])).toEqual(expected);
    expect(await resolveSides(dir, ["--cached"])).toEqual(expected);
  });

  test("单 rev：rev vs 工作区", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, ["HEAD~1"])).toEqual({
      oldSide: { type: "rev", rev: "HEAD~1" },
      newSide: { type: "worktree" },
    });
  });

  test("单 rev 加 --staged：rev vs 暂存区", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, ["HEAD~1", "--staged"])).toEqual({
      oldSide: { type: "rev", rev: "HEAD~1" },
      newSide: { type: "index" },
    });
  });

  test("A..B 区间：A vs B，缺省侧补 HEAD", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, ["main..feat"])).toEqual({
      oldSide: { type: "rev", rev: "main" },
      newSide: { type: "rev", rev: "feat" },
    });
    expect(await resolveSides(dir, ["..feat"])).toEqual({
      oldSide: { type: "rev", rev: "HEAD" },
      newSide: { type: "rev", rev: "feat" },
    });
    expect(await resolveSides(dir, ["main.."])).toEqual({
      oldSide: { type: "rev", rev: "main" },
      newSide: { type: "rev", rev: "HEAD" },
    });
  });

  test("两个独立 rev：前者 vs 后者", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, ["main", "feat"])).toEqual({
      oldSide: { type: "rev", rev: "main" },
      newSide: { type: "rev", rev: "feat" },
    });
  });

  test("A...B 区间：oldSide 为 merge-base，newSide 为 B", async () => {
    const { dir, base } = await makeDivergedRepo();
    // 确认分叉历史构造正确：git 算出的 merge-base 就是初始提交
    const mergeBase = (await $`git -C ${dir} merge-base main feat`.quiet().text()).trim();
    expect(mergeBase).toBe(base);

    const sides = await resolveSides(dir, ["main...feat"]);
    expect(sides.oldSide).toEqual({ type: "rev", rev: base });
    expect(sides.newSide).toEqual({ type: "rev", rev: "feat" });
  });

  test("rev 与 pathspec 混合：-- 之后的内容不当 rev", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, ["HEAD~1", "--", "src/"])).toEqual({
      oldSide: { type: "rev", rev: "HEAD~1" },
      newSide: { type: "worktree" },
    });
  });

  test("未知 flag（以 - 开头）被忽略，不当 rev", async () => {
    const dir = await makeRepo(true);
    expect(await resolveSides(dir, ["--stat", "HEAD~1"])).toEqual({
      oldSide: { type: "rev", rev: "HEAD~1" },
      newSide: { type: "worktree" },
    });
  });
});


describe("审阅数据范围", () => {
  test("工作区包含 untracked，暂存区与提交区间只包含选定范围", async () => {
    const dir = await makeRepo(true);
    await commitFile(dir, "tracked.ts", "const n = 1;\n", "添加源码");
    fs.writeFileSync(join(dir, "tracked.ts"), "const n = 2;\n");
    await $`git -C ${dir} add tracked.ts`.quiet();
    fs.writeFileSync(join(dir, "draft.ts"), "const draft = true;\n");
    const working = await getReviewDiff(dir, ["HEAD"], "en");
    expect(working.diff).toContain("draft.ts");
    const staged = await getReviewDiff(dir, ["--staged"], "en");
    expect(staged.diff).toContain("tracked.ts");
    expect(staged.diff).not.toContain("draft.ts");
    const range = await getReviewDiff(dir, ["HEAD~1..HEAD"], "en");
    expect(range.diff).toContain("+const n = 1;");
    expect(range.diff).not.toContain("draft.ts");
    expect(range.diff).not.toContain("+const n = 2;");
    const filtered = await getReviewDiff(dir, ["HEAD", "--", "tracked.ts"], "en");
    expect(filtered.diff).not.toContain("draft.ts");
  });

  test("空仓库暂存区可取得正确的空树基准", async () => {
    const dir = await makeRepo(false);
    fs.writeFileSync(join(dir, "first.ts"), "const n = 1;\n");
    await $`git -C ${dir} add first.ts`.quiet();
    const { diff, sides } = await getReviewDiff(dir, ["--staged"], "en");
    expect(diff).toContain("first.ts");
    expect(sides.oldSide.rev).toBe(EMPTY_TREE);
    expect(await getSideContent(dir, sides.newSide, "first.ts")).toBe("const n = 1;\n");
  });

  test("文件列表保留中文、空格、制表符与换行路径", async () => {
    const dir = await makeRepo(false);
    const names = ["中文.ts", "with space.ts", "with\ttab.ts", "with\nnewline.ts"];
    for (const name of names) fs.writeFileSync(join(dir, name), "const n = 1;\n");
    expect(await listUntracked(dir, [])).toEqual([...names].sort());
    expect(await listFiles(dir, "en")).toEqual([...names].sort());
    await $`git -C ${dir} add .`.quiet();
    expect(await listFiles(dir, "en")).toEqual([...names].sort());
    const { diff } = await getReviewDiff(dir, ["--staged"], "en");
    expect(diff).toContain("b/中文.ts");
  });
});
