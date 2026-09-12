import { Tooltip } from "./Tooltip";
import type { ChangeKind, ChangeUnit } from "../../src/analysis/types";
import { useStrings } from "./i18n";
import { KindGlyph } from "./icons";

/** 变更分类的样式类（与文件列表徽章同一配色，纯文字无描边） */
const CHANGE_CLASS: Record<ChangeKind, string> = {
  signature: "chg-signature",
  comment: "chg-comment",
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
    <Tooltip
      content={`${d.added.map((m) => `+${m}`).join(" ")}${d.removed.length > 0 ? ` / ${d.removed.map((m) => `−${m}`).join(" ")}` : ""}`}
    >
      <span className="unit-delta">
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
    </Tooltip>
  );
}

/** 按服务端分类顺序呈现导航入口，成员增删作为补充信号。 */
export function UnitList({
  units,
  onJump,
  selectedId,
}: {
  units: ChangeUnit[] | null;
  selectedId?: string;
  onJump: (unit: ChangeUnit) => void;
}) {
  const s = useStrings();
  if (!units || units.length === 0) return <div className="dim pad note">{s.noUnits}</div>;
  return (
    <div className="unit-list">
      {units.map((u) => {
        return (
          <Tooltip
            key={u.id}
            content={
              u.change === "signature" && u.oldSignature && u.signature ? (
                <span className="unit-signature-preview">
                  <span>{u.oldSignature}</span>
                  <span>→ {u.signature}</span>
                </span>
              ) : (
                u.name
              )
            }
          >
            <button
              className="unit-item"
              aria-pressed={selectedId === u.id}
              onClick={() => onJump(u)}
            >
              <KindGlyph kind={u.kind} />
              <span className="unit-name">{u.name}</span>
              <span className={`chg ${CHANGE_CLASS[u.change]}`}>{s.summaryChips[u.change]}</span>
              {u.domain && <MemberDelta unit={u} />}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
