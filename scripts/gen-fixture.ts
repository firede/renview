import { $ } from "bun";
import { mkdirSync, writeFileSync } from "node:fs";

/** 生成 test/fixture-repo（本地 dogfood 用的示例变更仓库）；已存在则跳过 */

const dir = "test/fixture-repo";

const check = await $`git -C ${dir} rev-parse --is-inside-work-tree`.quiet().nothrow();
if (check.exitCode === 0) {
  console.log(`${dir} 已存在，跳过`);
  process.exit(0);
}

const base = `export interface Point {
  x: number;
  y: number;
}

export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return \`hi \${name}\`;
}
`;

const changed = `export interface Point {
  x: number;
  y: number;
  z?: number;
}

export function add(a: number, b: number, c?: number): number {
  return a + b + (c ?? 0);
}

export function greet(name: string): string {
  return \`hello \${name}!\`;
}
`;

const untracked = `export function square(n: number): number {
  return n * n;
}
`;

mkdirSync(dir, { recursive: true });
await $`git -C ${dir} init -q`;
await $`git -C ${dir} config user.email fixture@renview.local`;
await $`git -C ${dir} config user.name fixture`;
writeFileSync(`${dir}/math.ts`, base);
await $`git -C ${dir} add .`;
await $`git -C ${dir} commit -qm base`;
writeFileSync(`${dir}/math.ts`, changed);
writeFileSync(`${dir}/util.ts`, untracked);
console.log(`${dir} 已生成（math.ts 已修改，util.ts 未跟踪）`);
