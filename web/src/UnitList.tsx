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
 * 当前文件的变更单元列表（服务端已按 签名→新增→删除→实现→类型 排序）。
 * 点击导航到 diff 对应行——单元是审阅顺序的物理化入口，先看契约再看实现。
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
      {units.map((u) => (
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
          <span className={`chg ${CHANGE_CLASS[u.change]}`}>{s.summaryChips[u.change]}</span>
        </button>
      ))}
    </div>
  );
}
