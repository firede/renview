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

const rustBase = `use std::collections::HashMap;

pub fn tally<'a, I: Iterator<Item = &'a str>>(words: I) -> HashMap<&'a str, u32> {
    let mut counts: HashMap<&'a str, u32> = HashMap::new();
    for word in words {
        *counts.entry(word).or_insert(0u32) += 1;
    }
    counts
}
`;

// 类型大量变化（u32 → usize）+ 一处真实逻辑变化（+= 1 → += 2）
const rustChanged = `use std::collections::HashMap;

pub fn tally<'a, I: Iterator<Item = &'a str>>(words: I) -> HashMap<&'a str, usize> {
    let mut counts: HashMap<&'a str, usize> = HashMap::new();
    for word in words {
        *counts.entry(word).or_insert(0usize) += 2;
    }
    counts
}
`;

mkdirSync(dir, { recursive: true });
await $`git -C ${dir} init -q`;
await $`git -C ${dir} config user.email fixture@renview.local`;
await $`git -C ${dir} config user.name fixture`;
writeFileSync(`${dir}/math.ts`, base);
writeFileSync(`${dir}/main.rs`, rustBase);
await $`git -C ${dir} add .`;
await $`git -C ${dir} commit -qm base`;
writeFileSync(`${dir}/math.ts`, changed);
writeFileSync(`${dir}/main.rs`, rustChanged);
writeFileSync(`${dir}/util.ts`, untracked);
console.log(`${dir} 已生成（math.ts / main.rs 已修改，util.ts 未跟踪）`);
