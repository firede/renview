import { useState } from "react";
import type { ChangeUnit, FileProjection } from "../../src/analysis/types";

const CHANGE_LABEL: Record<string, string> = {
  signature: "签名变更",
  body: "实现变更",
  "type-only": "类型变更",
  added: "新增",
  removed: "删除",
};

const KIND_LABEL: Record<string, string> = {
  function: "函数",
  class: "类",
  type: "类型",
  variable: "变量",
  other: "其他",
};

const NODE_KIND_LABEL: Record<string, string> = {
  if_statement: "if 分支",
  else_clause: "else 分支",
  for_statement: "for 循环",
  for_in_statement: "for-in 循环",
  for_of_statement: "for-of 循环",
  while_statement: "while 循环",
  do_statement: "do-while 循环",
  return_statement: "return",
  throw_statement: "throw",
  try_statement: "try",
  switch_statement: "switch",
  expression_statement: "表达式",
  lexical_declaration: "变量声明",
  variable_declaration: "变量声明",
  assignment_expression: "赋值",
  comment: "注释",
};

function UnitCard({ unit }: { unit: ChangeUnit }) {
  const [open, setOpen] = useState(unit.change === "signature" || unit.change === "added");
  return (
    <div className={`unit unit-${unit.change}`}>
      <button className="unit-head" onClick={() => setOpen(!open)}>
        <span className={`badge badge-${unit.change}`}>{CHANGE_LABEL[unit.change]}</span>
        <span className="unit-kind">{KIND_LABEL[unit.kind] ?? unit.kind}</span>
        <span className="unit-name">{unit.name}</span>
        <span className="unit-toggle">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="unit-body">
          {unit.oldSignature && <pre className="sig old">− {unit.oldSignature}</pre>}
          {unit.signature && <pre className="sig new">+ {unit.signature}</pre>}
          {unit.change === "type-only" && (
            <>
              <pre className="sig old">{unit.oldTypeText}</pre>
              <pre className="sig new">{unit.typeText}</pre>
            </>
          )}
          {unit.change === "body" &&
            (unit.bodySummary && unit.bodySummary.length > 0 ? (
              <ul className="body-summary">
                {unit.bodySummary.map((item, i) => (
                  <li key={i}>
                    <span className="node-kind">{NODE_KIND_LABEL[item.kind] ?? item.kind}</span>
                    <code>{item.preview}</code>
                    <span className="dim">{item.changedLines} 行变更</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dim note">实现细节有变更，可查看原始 diff。</div>
            ))}
          {unit.kind === "other" && (
            <div className="dim note">
              {unit.name}
              {unit.oldRange && `，旧版第 ${unit.oldRange[0]}–${unit.oldRange[1]} 行`}
              {unit.newRange && `，新版第 ${unit.newRange[0]}–${unit.newRange[1]} 行`}
              ，请查看原始 diff。
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectionView({ projection }: { projection: FileProjection }) {
  if (projection.units.length === 0) {
    return <div className="dim note pad">无实质声明变更（可能仅格式/注释变化），可查看原始 diff。</div>;
  }
  return (
    <div className="projection">
      {projection.units.map((u) => (
        <UnitCard key={u.id} unit={u} />
      ))}
    </div>
  );
}
