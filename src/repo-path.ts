import { constants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { MAX_SOURCE_BYTES, readSourceStream, SourceTooLargeError } from "./source";

export class InvalidRepoPathError extends Error {
  constructor() {
    super("路径必须位于仓库内且不能访问 .git");
  }
}

function forbiddenPart(part: string): boolean {
  // Windows 路径会归一化末尾点和空格；其他平台保留这些合法文件名。
  const name = process.platform === "win32" ? part.replace(/[. ]+$/, "") : part;
  return part === ".." || name.toLowerCase() === ".git";
}

/** 仅检查路径语法，供历史版本使用；不要求工作区对应路径存在。 */
export function safeRepoPath(root: string, path: string): string | null {
  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:/.test(path) ||
    (process.platform === "win32" && path.includes(":")) ||
    path.split(/[\\/]/).some(forbiddenPart)
  )
    return null;
  const abs = resolve(root, path);
  const rel = relative(resolve(root), abs);
  return rel && !isAbsolute(rel) && !rel.split(/[\\/]/).some(forbiddenPart) ? abs : null;
}

/** 父目录先规范化；最终链接读取链接文本，与 Git 的链接 blob 一致。 */
export async function readRepoSource(root: string, path: string): Promise<string> {
  const abs = safeRepoPath(root, path);
  if (!abs) throw new InvalidRepoPathError();
  const [repo, parent] = await Promise.all([realpath(root), realpath(dirname(abs))]);
  if (parent !== repo && !safeRepoPath(repo, relative(repo, parent)))
    throw new InvalidRepoPathError();
  const target = resolve(parent, basename(abs));
  const stat = await lstat(target);
  if (stat.isSymbolicLink()) return readlink(target);
  // 不跟随校验后被替换的最终链接，也不在 FIFO 上等待写入方。
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await file.stat();
    const actual = await realpath(target);
    if (
      !opened.isFile() ||
      opened.dev !== stat.dev ||
      opened.ino !== stat.ino ||
      !safeRepoPath(repo, relative(repo, actual))
    )
      throw new InvalidRepoPathError();
    if (opened.size > MAX_SOURCE_BYTES) throw new SourceTooLargeError();
    const head = Buffer.alloc(8192);
    const { bytesRead } = await file.read(head, 0, head.length, 0);
    if (head.subarray(0, bytesRead).includes(0)) return "\0";
    return await readSourceStream(Bun.file(file.fd).stream());
  } finally {
    await file.close();
  }
}
