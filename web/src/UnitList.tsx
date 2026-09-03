import type { ChangeKind, ChangeUnit } from "../../src/analysis/types";
import { useStrings } from "./i18n";
import { KindGlyph } from "./icons";

/** 变更分类的样式类（与文件列表徽章同一配色，纯文字无描边） */
const CHANGE_CLASS: Record<ChangeKind, string> = {
  signature: "chg-signature",
  body: "chg-body",
  "type-only": "chg-type-only",
  added: "chg-added",
  removed: "chg-removed",
};

/**
 * 数据形状变更的成员增删（行内信号，就近呈现）：
 * 只在成员集合真正变化时渲染（分析层已收窄：纯类型细节变更不带 domain）。
 * +z 绿显新增，−y 红字删除线；各取前 4，溢出记数（语言无关符号，无需文案）。
 */
function MemberDelta({ unit }: { unit: ChangeUnit }) {
  const d = unit.domain!;
  if (d.added.length === 0 && d.removed.length === 0) return null;
  const added = d.added.slice(0, 4);
  const removed = d.removed.slice(0, 4);
  const hidden = d.added.length - added.length + (d.removed.length - removed.length);
  return (
    <span
      className="unit-delta"
      title={`${d.added.map((m) => `+${m}`).join(" ")}${d.removed.length > 0 ? ` / ${d.removed.map((m) => `−${m}`).join(" ")}` : ""}`}
    >
      {added.map((m) => (
        <span key={`+${m}`} className="d-added">
          +{m}
        </span>
      ))}
      {removed.map((m) => (
        <span key={`-${m}`} className="d-removed">
          −{m}
        </span>
      ))}
      {hidden > 0 && <span className="d-more">…{hidden}</span>}
    </span>
  );
}

/**
 * 当前文件的变更单元列表（服务端已按 签名→新增→删除→形状→实现→类型 排序）。
 * 点击导航到 diff 对应行——单元是审阅顺序的物理化入口，先看契约再看实现。
 * 数据形状变更的成员增删直接缀在同一行内，不另起区域、不新增交互。
 * 同一种成员增减在不同语言下底层分类不同（TS 计类型、Python 计实现），
 * 行内徽章统一显示"结构"（中性色），不让语法分类泄漏到产品表达；
 * 实体增删（added/removed）本来跨语言一致，保留生命周期标签。
 */
export function UnitList({
  units,
  onJump,
}: {
  units: ChangeUnit[] | null;
  onJump: (unit: ChangeUnit) => void;
}) {
  const s = useStrings();
  if (!units || units.length === 0) return <div className="dim pad note">{s.noUnits}</div>;
  return (
    <div className="unit-list">
      {units.map((u) => {
        const isShape = u.domain != null && (u.change === "type-only" || u.change === "body");
        return (
          <button
            key={u.id}
            className="unit-item"
            title={
              u.change === "signature" && u.oldSignature && u.signature
                ? `${u.oldSignature}\n→ ${u.signature}`
                : u.name
            }
            onClick={() => onJump(u)}
          >
            <KindGlyph kind={u.kind} />
            <span className="unit-name">{u.name}</span>
            <span className={`chg ${isShape ? "chg-type-only" : CHANGE_CLASS[u.change]}`}>
              {isShape ? s.domainShape : s.summaryChips[u.change]}
            </span>
            {u.domain && <MemberDelta unit={u} />}
          </button>
        );
      })}
    </div>
  );
}
