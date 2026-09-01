import type { Node, Tree } from "web-tree-sitter";
import type { DeclarationInfo, LanguageProfile } from "./langs/types";
import { countLinesIn, touchedBy } from "./map";
import { parseSource } from "./parser";
import type { BodySummaryItem, ChangeKind, ChangeUnit, FileProjection, OutlineItem } from "./types";

export class ParseError extends Error {}

const TYPE_TEXT_LIMIT = 2000;

/** 空白归一化：仅格式变化不视为变更（已知局限：字符串字面量内的连续空格会被抹平） */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  return text.length > TYPE_TEXT_LIMIT ? `${text.slice(0, TYPE_TEXT_LIMIT)}…（截断）` : text;
}

/** 签名 = 单元起点到 body 起点（无 body 则整体）；含 export 等修饰符 */
function sigText(source: string, d: DeclarationInfo): string {
  const end = d.bodyNode ? d.bodyNode.startIndex : d.node.endIndex;
  return normalize(source.slice(d.node.startIndex, end));
}

function fullText(source: string, d: DeclarationInfo): string {
  return normalize(source.slice(d.node.startIndex, d.node.endIndex));
}

function pairKey(d: DeclarationInfo): string {
  return `${d.container}/${d.kind}/${d.name}`;
}

/** 按 key 分组、按位置排序后按下标配对；多余的一侧计为新增/删除 */
function pairUp(
  olds: DeclarationInfo[],
  news: DeclarationInfo[],
): Array<[DeclarationInfo | null, DeclarationInfo | null]> {
  const group = (list: DeclarationInfo[]) => {
    const m = new Map<string, DeclarationInfo[]>();
    for (const d of list) {
      const k = pairKey(d);
      const arr = m.get(k) ?? [];
      arr.push(d);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.node.startIndex - b.node.startIndex);
    return m;
  };
  const oldMap = group(olds);
  const newMap = group(news);
  const keys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const pairs: Array<[DeclarationInfo | null, DeclarationInfo | null]> = [];
  for (const key of keys) {
    const os = oldMap.get(key) ?? [];
    const ns = newMap.get(key) ?? [];
    for (let i = 0; i < Math.max(os.length, ns.length); i++) {
      pairs.push([os[i] ?? null, ns[i] ?? null]);
    }
  }
  return pairs;
}

function summarizeBody(body: Node, lines: Set<number>): BodySummaryItem[] {
  const items: BodySummaryItem[] = [];
  for (const child of body.namedChildren) {
    if (!touchedBy(child, lines)) continue;
    const firstLine = child.text.split("\n", 1)[0] ?? "";
    items.push({
      kind: child.type,
      preview: firstLine.trim().slice(0, 80),
      changedLines: countLinesIn(child, lines),
    });
  }
  return items;
}

function rangeOf(d: DeclarationInfo): [number, number] {
  return [d.node.startPosition.row + 1, d.node.endPosition.row + 1];
}

const CHANGE_ORDER: Record<ChangeKind, number> = {
  signature: 0,
  added: 1,
  removed: 2,
  body: 3,
  "type-only": 4,
};

/** 一侧已解析的源码（投影与简化共用，每侧源码只 parse 一次） */
export interface ParsedSide {
  tree: Tree;
  source: string;
}

/** 解析一侧源码为 ParsedSide */
export async function parseSide(profile: LanguageProfile, source: string): Promise<ParsedSide> {
  return { tree: await parseSource(profile.grammarFile, source), source };
}

/**
 * 分析单个文件已解析的新旧版本，产出投影。
 * 配对基于全量声明（而非仅触碰的），避免"纯删除行导致新侧未触碰"被误判为 removed。
 * 触碰但归一化文本无变化的声明不产生单元（过滤纯注释/格式噪音）。
 */
export function analyzeParsed(
  profile: LanguageProfile,
  oldSide: ParsedSide | null,
  newSide: ParsedSide | null,
  oldLines: Set<number>,
  newLines: Set<number>,
): FileProjection {
  const oldTree = oldSide?.tree ?? null;
  const newTree = newSide?.tree ?? null;
  const oldSource = oldSide?.source ?? null;
  const newSource = newSide?.source ?? null;
  if (oldTree?.rootNode.hasError || newTree?.rootNode.hasError) {
    throw new ParseError("tree-sitter 解析存在错误节点");
  }

  const olds = oldSide ? profile.collect(oldSide.tree.rootNode) : [];
  const news = newSide ? profile.collect(newSide.tree.rootNode) : [];
  const pairs = pairUp(olds, news);

  const units: ChangeUnit[] = [];

  for (const [o, n] of pairs) {
    const touched = (o && touchedBy(o.node, oldLines)) || (n && touchedBy(n.node, newLines));
    if (!touched) continue;

    const unit = classify(o, n, oldSource, newSource, newLines, oldLines);
    if (!unit) continue; // 触碰但无实质变化
    units.push(unit);
  }

  // 类整体的 body 变更若已被成员单元完全覆盖（方法改动），去掉重复的类单元
  const deduped = units.filter((cu) => {
    if (cu.kind !== "class" || cu.change !== "body") return true;
    const [s, e] = cu.newRange ?? cu.oldRange!;
    const lines = cu.newRange ? newLines : oldLines;
    for (const ln of lines) {
      if (ln < s || ln > e) continue;
      const covered = units.some(
        (u) =>
          u !== cu &&
          ((u.newRange && ln >= u.newRange[0] && ln <= u.newRange[1]) ||
            (u.oldRange && ln >= u.oldRange[0] && ln <= u.oldRange[1])),
      );
      if (!covered) return true;
    }
    return false;
  });

  // 声明之外的变更（import、顶层表达式等）归入兜底单元，保证任何变更都可审
  const coveredOld = deduped.flatMap((u) => (u.oldRange ? [u.oldRange] : []));
  const coveredNew = deduped.flatMap((u) => (u.newRange ? [u.newRange] : []));
  const strayOld = strayLines(oldLines, coveredOld);
  const strayNew = strayLines(newLines, coveredNew);
  if (strayOld || strayNew) {
    const oldComments = oldTree ? collectCommentRanges(oldTree.rootNode) : [];
    const newComments = newTree ? collectCommentRanges(newTree.rootNode) : [];
    const commentOnly =
      (!strayOld || strayAllInComments(oldLines, coveredOld, oldComments)) &&
      (!strayNew || strayAllInComments(newLines, coveredNew, newComments));
    deduped.push({
      id: `other:${strayOld?.[0] ?? strayNew?.[0] ?? 0}`,
      kind: "other",
      name: commentOnly ? "注释变更" : "声明之外的变更",
      change: "body",
      oldRange: strayOld ?? undefined,
      newRange: strayNew ?? undefined,
    });
  }

  deduped.sort((a, b) => {
    const d = CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change];
    if (d !== 0) return d;
    return (a.newRange?.[0] ?? a.oldRange?.[0] ?? 0) - (b.newRange?.[0] ?? b.oldRange?.[0] ?? 0);
  });

  const summary: Record<ChangeKind, number> = {
    signature: 0,
    body: 0,
    "type-only": 0,
    added: 0,
    removed: 0,
  };
  for (const u of deduped) summary[u.change]++;

  return { language: profile.id, summary, units: deduped };
}

/** analyzeParsed 的包装：先解析两侧源码（服务端以外、无需复用 CST 的调用方使用） */
export async function analyzeFile(
  profile: LanguageProfile,
  oldSource: string | null,
  newSource: string | null,
  oldLines: Set<number>,
  newLines: Set<number>,
): Promise<FileProjection> {
  const [oldSide, newSide] = await Promise.all([
    oldSource != null ? parseSide(profile, oldSource) : null,
    newSource != null ? parseSide(profile, newSource) : null,
  ]);
  return analyzeParsed(profile, oldSide, newSide, oldLines, newLines);
}

/** 查看器用：从已解析的 CST 产出文件大纲（与投影/简化同源，复用声明收集） */
export function outlineOf(profile: LanguageProfile, tree: Tree): OutlineItem[] {
  return profile.collect(tree.rootNode).map((d) => ({
    kind: d.kind,
    name: d.name,
    container: d.container,
    typeLevel: d.typeLevel,
    range: rangeOf(d),
  }));
}

function classify(
  o: DeclarationInfo | null,
  n: DeclarationInfo | null,
  oldSource: string | null,
  newSource: string | null,
  newLines: Set<number>,
  oldLines: Set<number>,
): ChangeUnit | null {
  const base = {
    id: `${o ? pairKey(o) : pairKey(n!)}:${n?.node.startPosition.row ?? o?.node.startPosition.row ?? 0}`,
    kind: (n ?? o)!.kind,
    name: (n ?? o)!.name,
    oldRange: o ? rangeOf(o) : undefined,
    newRange: n ? rangeOf(n) : undefined,
  };

  if (o && !n) {
    return { ...base, change: "removed", oldSignature: sigText(oldSource!, o) };
  }
  if (!o && n) {
    return { ...base, change: "added", signature: sigText(newSource!, n) };
  }
  if (!o || !n || oldSource == null || newSource == null) return null;

  if (o.typeLevel || n.typeLevel) {
    if (fullText(oldSource, o) === fullText(newSource, n)) return null;
    return {
      ...base,
      change: "type-only",
      typeText: truncate(n.node.text),
      oldTypeText: truncate(o.node.text),
    };
  }

  const os = sigText(oldSource, o);
  const ns = sigText(newSource, n);
  if (os !== ns) {
    return { ...base, change: "signature", signature: ns, oldSignature: os };
  }

  if (o.bodyNode && n.bodyNode) {
    const ob = normalize(
      oldSource.slice(o.bodyNode.startIndex, o.bodyNode.endIndex),
    );
    const nb = normalize(
      newSource.slice(n.bodyNode.startIndex, n.bodyNode.endIndex),
    );
    if (ob === nb) return null;
    return { ...base, change: "body", bodySummary: summarizeBody(n.bodyNode, newLines) };
  }

  // 无 body 的非类型级单元（变量、枚举等）：整体比较
  if (fullText(oldSource, o) !== fullText(newSource, n)) {
    return { ...base, change: "body", signature: sigText(newSource, n), oldSignature: sigText(oldSource, o) };
  }
  return null;
}

/** 未被任何单元覆盖的变更行；有则返回其跨度 */
function strayLines(
  lines: Set<number>,
  covered: Array<[number, number]>,
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const ln of lines) {
    const hit = covered.some(([s, e]) => ln >= s && ln <= e);
    if (!hit) {
      min = Math.min(min, ln);
      max = Math.max(max, ln);
    }
  }
  return max >= min ? [min, max] : null;
}

/** 收集所有注释节点的行范围（1-based） */
function collectCommentRanges(root: Node): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const walk = (n: Node) => {
    if (n.type === "comment") {
      ranges.push([n.startPosition.row + 1, n.endPosition.row + 1]);
      return;
    }
    for (const c of n.namedChildren) walk(c);
  };
  walk(root);
  return ranges;
}

/** 所有 stray 行（未被单元覆盖的变更行）是否都落在注释内 */
function strayAllInComments(
  lines: Set<number>,
  covered: Array<[number, number]>,
  comments: Array<[number, number]>,
): boolean {
  for (const ln of lines) {
    if (covered.some(([s, e]) => ln >= s && ln <= e)) continue;
    if (!comments.some(([s, e]) => ln >= s && ln <= e)) return false;
  }
  return true;
}
