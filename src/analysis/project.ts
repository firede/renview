import type { Node, Tree } from "web-tree-sitter";
import { messages, type Locale } from "../i18n";
import type { DeclarationInfo, LanguageProfile } from "./langs/types";
import { countLinesIn, touchedBy } from "./map";
import { parseSource } from "./parser";
import type { SRow } from "./simplify";
import type { BodySummaryItem, ChangeKind, ChangeUnit, FileProjection, OutlineItem } from "./types";

export class ParseError extends Error {}

const TYPE_TEXT_LIMIT = 2000;

/** 空白归一化：仅格式变化不视为变更（已知局限：字符串字面量内的连续空格会被抹平） */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

function fullText(source: string, d: DeclarationInfo): string {
  return normalize(source.slice(d.node.startIndex, d.node.endIndex));
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
    // 注释不是决策点，不进摘要（注释变更已有低优先级单元承接）
    if (child.type.includes("comment")) continue;
    const firstLine = child.text.split("\n", 1)[0] ?? "";
    items.push({
      kind: child.type,
      preview: firstLine.trim().slice(0, 80),
      newLn: child.startPosition.row + 1,
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

/**
 * 审阅排序（先看契约再看实现）：
 * 成员增减的形状信号（带 domain）先于普通实现，纯类型细节（无 domain 的 type-only）仍在末尾。
 * added/removed 的实体生命周期顺序不变（它们本来就在 body 之前）。
 */
function unitRank(u: ChangeUnit): number {
  if (u.change !== "body" && u.change !== "type-only") return CHANGE_ORDER[u.change];
  if (u.domain) return 2.5;
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
 * 触碰但归一化文本无变化的声明不产生单元（过滤纯注释/格式噪音）。
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

    const unit = classify(profile, o, n, oldSource, newSource, newLines, oldLines, locale);
    if (!unit) continue; // 触碰但无实质变化
    units.push(unit);
  }

  // 类整体的 body 变更若已被成员单元完全覆盖（方法改动），去掉重复的类单元；
  // 但数据形状类（带 domain，如 Python 纯数据类）保留——类级单元正是领域总览的入口
  const deduped = units.filter((cu) => {
    if (cu.kind !== "class" || cu.change !== "body") return true;
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
      name: commentOnly
        ? messages(locale).analysis.commentChanges
        : messages(locale).analysis.outsideDeclarations,
      container: "",
      change: "body",
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
    body: 0,
    "type-only": 0,
    added: 0,
    removed: 0,
  };
  for (const u of deduped) summary[u.change]++;

  return { language: profile.id, summary, units: deduped };
}

/** 单条实现摘要最多列出的条目数（超出以总数收尾） */
const BODY_NOTE_MAX_ITEMS = 3;
/** 产出行内摘要的条目门槛：单条变更在行流中自明，摘要纯属重复 */
const BODY_NOTE_MIN_ITEMS = 2;

/**
 * 实现摘要注释行：body 变更单元的决策点/调用枚举（结构化枚举，非自然语言），
 * 插入该单元范围内首个变更行之前。预览取简化文本（与行流同一投影），被抹空时回落原始预览。
 */
export function insertBodyNotes(
  rows: SRow[],
  units: ChangeUnit[],
  newSimplifiedLines: string[] | null,
  locale: Locale,
): SRow[] {
  const pending: Array<{ start: number; end: number; text: string }> = [];
  for (const u of units) {
    if (u.change !== "body" || !u.newRange) continue;
    const items = u.bodySummary ?? [];
    if (items.length < BODY_NOTE_MIN_ITEMS) continue;
    const parts = items
      .slice(0, BODY_NOTE_MAX_ITEMS)
      .map((it) => (newSimplifiedLines?.[it.newLn - 1]?.trim() || it.preview).slice(0, 80));
    pending.push({
      start: u.newRange[0],
      end: u.newRange[1],
      text: messages(locale).analysis.bodyNote(
        parts,
        items.length,
        items.length > BODY_NOTE_MAX_ITEMS,
      ),
    });
  }
  if (pending.length === 0) return rows;
  pending.sort((a, b) => a.start - b.start);

  const out: SRow[] = [];
  let pi = 0;
  for (const row of rows) {
    // del 行无新侧行号，用旧侧行号近似定位（插入位置的启发式，不用于锚定）
    const ln = row.kind === "fold" || row.kind === "note" ? null : (row.newLn ?? row.oldLn ?? null);
    if (ln != null) {
      while (pi < pending.length && ln > pending[pi]!.end) pi++; // 范围内无可挂行，放弃该摘要
      while (pi < pending.length && ln >= pending[pi]!.start) {
        out.push({ kind: "note", text: pending[pi]!.text });
        pi++;
      }
    }
    out.push(row);
  }
  return out;
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
  newLines: Set<number>,
  oldLines: Set<number>,
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

  if (o.typeLevel || n.typeLevel) {
    if (fullText(oldSource, o) === fullText(newSource, n)) return null;
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
  if (os !== ns) {
    return { ...base, change: "signature", signature: ns, oldSignature: os };
  }

  if (o.bodyNode && n.bodyNode) {
    const ob = normalize(oldSource.slice(o.bodyNode.startIndex, o.bodyNode.endIndex));
    const nb = normalize(newSource.slice(n.bodyNode.startIndex, n.bodyNode.endIndex));
    if (ob === nb) return null;
    const u: ChangeUnit = {
      ...base,
      change: "body",
      bodySummary: summarizeBody(n.bodyNode, newLines),
    };
    // 非数据类（如含方法的 class）的 body 变更不是数据形状变更，不进领域总览
    attachDomain(profile, u, o, n, locale);
    return u;
  }

  // 无 body 的非类型级单元（变量、枚举等）：整体比较
  if (fullText(oldSource, o) !== fullText(newSource, n)) {
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
