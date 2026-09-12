import type { Node, Tree } from "web-tree-sitter";
import { messages, type Locale } from "../i18n";
import type { DeclarationInfo, LanguageProfile } from "./langs/types";
import { touchedBy } from "./map";
import { parseSource } from "./parser";
import type { ChangeKind, ChangeUnit, FileProjection, OutlineItem } from "./types";

export class ParseError extends Error {}

const TYPE_TEXT_LIMIT = 2000;

/** 仅用于摘要展示；变更判断使用语法 token，保留字面量内的空白。 */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isComment(node: Node): boolean {
  return /^(comment|line_comment|block_comment|multiline_comment)$/.test(node.type);
}

/** 保留 token 边界与字面量原文，忽略语法间空白。 */
function syntaxText(
  node: Node,
  includeComments = false,
  end = node.endIndex,
  variableSignature = false,
): string {
  const tokens: string[] = [];
  const walk = (current: Node) => {
    if (current.startIndex >= end) return;
    if (isComment(current)) {
      if (includeComments) tokens.push(current.text);
      return;
    }
    if (variableSignature && current.type === "=") return;
    if (current.childCount === 0 || /string|template|char_literal/.test(current.type)) {
      tokens.push(current.type, current.text);
      return;
    }
    tokens.push(current.type, "(");
    for (let i = 0; i < current.childCount; i++) {
      const field = current.fieldNameForChild(i);
      if (variableSignature && (field === "value" || field === "right")) continue;
      walk(current.child(i)!);
    }
    tokens.push(")");
  };
  walk(node);
  return JSON.stringify(tokens);
}

function truncate(text: string, locale: Locale): string {
  return text.length > TYPE_TEXT_LIMIT
    ? `${text.slice(0, TYPE_TEXT_LIMIT)}${messages(locale).analysis.truncatedSuffix}`
    : text;
}

/** 签名 = 单元起点到 body 起点（无 body 则整体）；含 export 等修饰符 */
function sigText(source: string, d: DeclarationInfo): string {
  const end = d.bodyNode ? d.bodyNode.startIndex : d.node.endIndex;
  return normalize(source.slice(d.node.startIndex, end));
}

function pairKey(d: DeclarationInfo): string {
  // 重载签名与实现分别配对，避免增删签名时把函数正文错配为类型变更。
  const kind = d.kind === "function" && d.typeLevel ? "function-signature" : d.kind;
  return `${d.container}/${kind}/${d.name}`;
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
    let os = oldMap.get(key) ?? [];
    let ns = newMap.get(key) ?? [];
    if (os.some((d) => d.pairingSignature) || ns.some((d) => d.pairingSignature)) {
      const available = new Map<string, DeclarationInfo[]>();
      for (const n of ns) {
        if (!n.pairingSignature) continue;
        const group = available.get(n.pairingSignature) ?? [];
        group.push(n);
        available.set(n.pairingSignature, group);
      }
      const paired = new Set<DeclarationInfo>();
      os = os.filter((o) => {
        const match = o.pairingSignature ? available.get(o.pairingSignature)?.shift() : null;
        if (!match) return true;
        pairs.push([o, match]);
        paired.add(match);
        return false;
      });
      ns = ns.filter((n) => !paired.has(n));
    }
    for (let i = 0; i < Math.max(os.length, ns.length); i++) {
      pairs.push([os[i] ?? null, ns[i] ?? null]);
    }
  }
  return pairs;
}

function rangeOf(d: DeclarationInfo): [number, number] {
  return [d.node.startPosition.row + 1, d.node.endPosition.row + 1];
}

/** 按类别聚合；先读声明契约，再读增删与实现，注释保留独立入口。 */
const CHANGE_ORDER: Record<ChangeKind, number> = {
  signature: 0,
  "type-only": 1,
  added: 2,
  removed: 3,
  body: 4,
  comment: 5,
};

function unitRank(u: ChangeUnit): number {
  return CHANGE_ORDER[u.change];
}

/** 一侧已解析的源码（投影与简化共用，每侧源码只 parse 一次） */
export interface ParsedSide {
  tree: Tree;
  source: string;
}

/** 解析一侧源码；调用方负责 tree.delete()，通常应使用 withParsedSides 限定生命周期 */
export async function parseSide(profile: LanguageProfile, source: string): Promise<ParsedSide> {
  return { tree: await parseSource(profile.grammarFile, source), source };
}

/** 回调只能返回脱离 CST 的数据；两侧解析、分析或简化失败时也立即释放已分配的树。 */
export async function withParsedSides<T>(
  profile: LanguageProfile,
  oldSource: string | null,
  newSource: string | null,
  run: (oldSide: ParsedSide | null, newSide: ParsedSide | null) => T,
): Promise<T> {
  let oldSide: ParsedSide | null = null;
  let newSide: ParsedSide | null = null;
  try {
    // 顺序取得所有权，避免 Promise.all 某侧失败时丢失另一侧已经分配的树。
    if (oldSource != null) oldSide = await parseSide(profile, oldSource);
    if (newSource != null) newSide = await parseSide(profile, newSource);
    return await run(oldSide, newSide);
  } finally {
    oldSide?.tree.delete();
    newSide?.tree.delete();
  }
}

/**
 * 分析单个文件已解析的新旧版本，产出投影。
 * 配对基于全量声明（而非仅触碰的），避免"纯删除行导致新侧未触碰"被误判为 removed。
 * 触碰但归一化文本无变化的声明不产生单元；声明内注释变化仍保留所属声明的审阅入口。
 */
export function analyzeParsed(
  profile: LanguageProfile,
  oldSide: ParsedSide | null,
  newSide: ParsedSide | null,
  oldLines: Set<number>,
  newLines: Set<number>,
  locale: Locale,
): FileProjection {
  const oldTree = oldSide?.tree ?? null;
  const newTree = newSide?.tree ?? null;
  const oldSource = oldSide?.source ?? null;
  const newSource = newSide?.source ?? null;
  if (oldTree?.rootNode.hasError || newTree?.rootNode.hasError) {
    throw new ParseError("tree-sitter 解析存在错误节点");
  }

  const olds = oldSide ? profile.collect(oldSide.tree.rootNode, locale) : [];
  const news = newSide ? profile.collect(newSide.tree.rootNode, locale) : [];
  const pairs = pairUp(olds, news);

  const units: ChangeUnit[] = [];

  for (const [o, n] of pairs) {
    const touched = (o && touchedBy(o.node, oldLines)) || (n && touchedBy(n.node, newLines));
    if (!touched) continue;

    const unit = classify(profile, o, n, oldSource, newSource, locale);
    if (!unit) continue; // 触碰但无实质变化
    units.push(unit);
  }

  // 类整体的 body 变更若已被成员单元完全覆盖（方法改动），去掉重复的类单元；
  // 但数据形状类（带 domain，如 Python 纯数据类）保留——类级单元正是领域总览的入口
  const deduped = units.filter((cu) => {
    if (cu.kind !== "class" || (cu.change !== "body" && cu.change !== "comment")) return true;
    if (cu.domain) return true;
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
  const coveredOld = olds.map(rangeOf);
  const coveredNew = news.map(rangeOf);
  // 已过滤的声明不再回流到兜底单元；空行保留在原始 diff 中，不构成审阅入口。
  const nonBlank = (source: string | null, lines: Set<number>) => {
    const text = source?.split("\n") ?? [];
    return new Set([...lines].filter((ln) => text[ln - 1]?.trim()));
  };
  const meaningfulOld = nonBlank(oldSource, oldLines);
  const meaningfulNew = nonBlank(newSource, newLines);
  const strayOld = strayLines(meaningfulOld, coveredOld);
  const strayNew = strayLines(meaningfulNew, coveredNew);
  if (strayOld || strayNew) {
    const oldComments = oldTree ? collectCommentRanges(oldTree.rootNode) : [];
    const newComments = newTree ? collectCommentRanges(newTree.rootNode) : [];
    const commentOnly =
      (!strayOld ||
        strayAllInComments(meaningfulOld, coveredOld, oldComments, oldTree?.rootNode ?? null)) &&
      (!strayNew ||
        strayAllInComments(meaningfulNew, coveredNew, newComments, newTree?.rootNode ?? null));
    deduped.push({
      id: `other:${strayOld?.[0] ?? strayNew?.[0] ?? 0}`,
      kind: "other",
      name: commentOnly
        ? messages(locale).analysis.commentChanges
        : messages(locale).analysis.outsideDeclarations,
      container: "",
      change: commentOnly ? "comment" : "body",
      oldRange: strayOld ?? undefined,
      newRange: strayNew ?? undefined,
    });
  }

  deduped.sort((a, b) => {
    const d = unitRank(a) - unitRank(b);
    if (d !== 0) return d;
    return (a.newRange?.[0] ?? a.oldRange?.[0] ?? 0) - (b.newRange?.[0] ?? b.oldRange?.[0] ?? 0);
  });

  const summary: Record<ChangeKind, number> = {
    signature: 0,
    comment: 0,
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
  locale: Locale,
): Promise<FileProjection> {
  return withParsedSides(profile, oldSource, newSource, (oldSide, newSide) =>
    analyzeParsed(profile, oldSide, newSide, oldLines, newLines, locale),
  );
}

/** 查看器用：从已解析的 CST 产出文件大纲（与投影/简化同源，复用声明收集） */
export function outlineOf(profile: LanguageProfile, tree: Tree, locale: Locale): OutlineItem[] {
  return profile.collect(tree.rootNode, locale).map((d) => ({
    kind: d.kind,
    name: d.name,
    container: d.container,
    typeLevel: d.typeLevel,
    range: rangeOf(d),
    signature:
      d.kind === "function" || d.kind === "class"
        ? normalize(
            d.node.text.slice(
              0,
              d.bodyNode ? d.bodyNode.startIndex - d.node.startIndex : undefined,
            ),
          )
        : undefined,
  }));
}

/**
 * 领域成员挂载（数据形状变更的行内信号源）：
 * 只处理数据形状候选（kind 为 type，或纯数据 class），且只在"成员集合"发生变化时挂载——
 * 有成员的实体增删（added/removed）必挂、成员增减（added/removed 非空）才挂；无成员实体（type 别名等）不挂。
 * 纯类型细节变更（number→string，成员无增减）不挂：它已在折叠摘要里就近呈现，再聚一次是重复。
 * 成员提取复用各语言现成的 typeDeclMembers hook（新语言无此 hook 时自然缺席，不阻塞）。
 */
function attachDomain(
  profile: LanguageProfile,
  u: ChangeUnit,
  o: DeclarationInfo | null,
  n: DeclarationInfo | null,
  locale: Locale,
): void {
  if (u.kind !== "type" && u.kind !== "class") return;
  const hook = profile.typeDeclMembers;
  if (!hook) return;
  const oldInfo = o ? hook(o.node, locale) : null;
  const newInfo = n ? hook(n.node, locale) : null;
  if (!oldInfo && !newInfo) return;
  const oldMembers = oldInfo?.members.map((m) => m.name) ?? [];
  const newMembers = newInfo?.members.map((m) => m.name) ?? [];
  const oldSet = new Set(oldMembers);
  const newSet = new Set(newMembers);
  const added = newMembers.filter((m) => !oldSet.has(m));
  const removed = oldMembers.filter((m) => !newSet.has(m));
  // 无成员的实体（如 type 别名）增删不构成数据形状信号，不挂空 domain
  if (oldMembers.length === 0 && newMembers.length === 0) return;
  // 实体增删必留；成员集合不变的细节变更不留
  if (
    u.change !== "added" &&
    u.change !== "removed" &&
    added.length === 0 &&
    removed.length === 0
  ) {
    return;
  }
  u.domain = {
    members: newMembers.length > 0 ? newMembers : oldMembers,
    added,
    removed,
  };
}

function classify(
  profile: LanguageProfile,
  o: DeclarationInfo | null,
  n: DeclarationInfo | null,
  oldSource: string | null,
  newSource: string | null,
  locale: Locale,
): ChangeUnit | null {
  const ref = n ?? o;
  const base = {
    id: `${o ? pairKey(o) : pairKey(n!)}:${n?.node.startPosition.row ?? o?.node.startPosition.row ?? 0}`,
    kind: ref!.kind,
    name: ref!.name,
    container: ref!.container,
    oldRange: o ? rangeOf(o) : undefined,
    newRange: n ? rangeOf(n) : undefined,
  };

  if (o && !n) {
    const removed: ChangeUnit = {
      ...base,
      change: "removed",
      oldSignature: sigText(oldSource!, o),
    };
    attachDomain(profile, removed, o, null, locale);
    return removed;
  }
  if (!o && n) {
    const added: ChangeUnit = { ...base, change: "added", signature: sigText(newSource!, n) };
    attachDomain(profile, added, null, n, locale);
    return added;
  }
  if (!o || !n || oldSource == null || newSource == null) return null;

  if (syntaxText(o.node) === syntaxText(n.node)) {
    if (syntaxText(o.node, true) === syntaxText(n.node, true)) return null;
    return { ...base, change: "comment" };
  }

  if ((o.typeLevel || n.typeLevel) && ref!.kind !== "function") {
    const u: ChangeUnit = {
      ...base,
      change: "type-only",
      typeText: truncate(n.node.text, locale),
      oldTypeText: truncate(o.node.text, locale),
    };
    attachDomain(profile, u, o, n, locale);
    return u;
  }

  const os = sigText(oldSource, o);
  const ns = sigText(newSource, n);
  const oldSignature = syntaxText(o.node, false, o.bodyNode?.startIndex, o.kind === "variable");
  const newSignature = syntaxText(n.node, false, n.bodyNode?.startIndex, n.kind === "variable");
  if (oldSignature !== newSignature) {
    const u: ChangeUnit = { ...base, change: "signature", signature: ns, oldSignature: os };
    attachDomain(profile, u, o, n, locale);
    return u;
  }

  if (o.bodyNode && n.bodyNode) {
    const ob = syntaxText(o.bodyNode);
    const nb = syntaxText(n.bodyNode);
    if (ob === nb) return null;
    const u: ChangeUnit = {
      ...base,
      change: "body",
    };
    // 非数据类（如含方法的 class）的 body 变更不是数据形状变更，不进领域总览
    attachDomain(profile, u, o, n, locale);
    return u;
  }

  // 无 body 的非类型级单元（变量、枚举等）：整体比较
  if (syntaxText(o.node) !== syntaxText(n.node)) {
    return {
      ...base,
      change: "body",
      signature: sigText(newSource, n),
      oldSignature: sigText(oldSource, o),
    };
  }
  return null;
}

/** 未被任何单元覆盖的变更行；有则返回其跨度 */
function strayLines(lines: Set<number>, covered: Array<[number, number]>): [number, number] | null {
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
    if (isComment(n)) {
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
  root: Node | null,
): boolean {
  const stray = new Set<number>();
  for (const ln of lines) {
    if (covered.some(([s, e]) => ln >= s && ln <= e)) continue;
    if (!comments.some(([s, e]) => ln >= s && ln <= e)) return false;
    stray.add(ln);
  }
  // 行范围只能证明存在注释；同行还有代码时不能降为纯注释。
  const hasCode = (node: Node): boolean => {
    if (isComment(node)) return false;
    if (node.childCount > 0) return node.children.some(hasCode);
    if (!node.text.trim()) return false;
    for (let line = node.startPosition.row + 1; line <= node.endPosition.row + 1; line++) {
      if (stray.has(line)) return true;
    }
    return false;
  };
  return root != null && !hasCode(root);
}
