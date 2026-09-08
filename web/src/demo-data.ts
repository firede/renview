import type { FileEntry, ReviewContext } from "../../src/analysis/types";

/** 静态样例沿用查看器接口结构，包含全文上下文，支持真实的展开与定位。 */
export interface DemoChangeset {
  diff: {
    ok: true;
    snapshot: string;
    repoRoot: string;
    diffArgs: string[];
    diff: string;
    files: FileEntry[];
  };
  reviews: Record<string, ReviewContext & { ok: true; snapshot: string; entry: FileEntry }>;
}
