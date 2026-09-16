/**
 * 变更文件列表的价值分层：锁文件与生成产物不承载业务变化，沉到列表末尾，也不作为默认落地文件。
 * 判定只看路径（本地与在线版共用，不依赖仓库属性）；宁可漏判也不误判——误判会把业务文件藏到最后。
 */

const LOCKFILES = new Set([
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "go.sum",
  "gemfile.lock",
  "poetry.lock",
  "pipfile.lock",
  "uv.lock",
  "composer.lock",
  "podfile.lock",
  "package.resolved",
  "flake.lock",
  "mix.lock",
  "pubspec.lock",
  "gradle.lockfile",
]);

/** 生成产物的文件名特征（大小写不敏感） */
const GENERATED_NAME = /(?:\.gen|\.generated|\.g|\.pb|\.min|\.snap|\.map)\.[a-z0-9]+$|\.d\.ts$/i;
/** 生成产物的目录特征 */
const GENERATED_DIR =
  /(?:^|\/)(?:dist|build|out|__generated__|__snapshots__|node_modules|vendor)\//;

/** 路径是否属于锁文件或生成产物 */
export function isLowValuePath(path: string): boolean {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (LOCKFILES.has(base)) return true;
  if (GENERATED_NAME.test(base)) return true;
  return GENERATED_DIR.test(path);
}

export interface RankableFile {
  path: string;
  /** 分析层摘要（无投影时为 null） */
  signatureChanges: number;
  unitCount: number;
}

/**
 * 默认落地文件：先看契约——首个含签名变更的文件；其次首个有声明级变更的文件；
 * 再次首个非低价值文件；都没有则第一个。输入须已按列表顺序排好。
 */
export function defaultLandingIndex(files: RankableFile[]): number {
  if (files.length === 0) return 0;
  const pick = (test: (f: RankableFile) => boolean) => {
    const i = files.findIndex((f) => !isLowValuePath(f.path) && test(f));
    return i >= 0 ? i : null;
  };
  return (
    pick((f) => f.signatureChanges > 0) ?? pick((f) => f.unitCount > 0) ?? pick(() => true) ?? 0
  );
}
