import { describe, expect, test } from "bun:test";
import { gdscriptProfile } from "../src/analysis/langs/gdscript";
import { goProfile } from "../src/analysis/langs/go";
import type { LanguageProfile } from "../src/analysis/langs/types";
import { parseSource } from "../src/analysis/parser";
import { applySimplify, collectSimplifyOps, simplifyTree } from "../src/analysis/simplify";
import { buildViewRows } from "../src/analysis/view";

async function simplify(profile: LanguageProfile, source: string): Promise<string[]> {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, profile.simplify!));
}

async function viewRows(profile: LanguageProfile, source: string) {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  return buildViewRows(profile, tree, source, simplifyTree(tree, source, profile.simplify!));
}

describe("go 简化器", () => {
  test("参数/返回值/字段类型擦除，可变参数保留 ...", async () => {
    const src = `package main

func NewServer(addr string, opts ...Option) *Server {
	return &Server{addr: addr}
}
`;
    const out = await simplify(goProfile, src);
    expect(out).toEqual([
      "package main",
      "",
      "func NewServer(addr, opts ...) *Server {".replace(" *Server", ""), // result 擦除
      "\treturn &Server{addr: addr}",
      "}",
      "",
    ]);
    expect(out[2]).toBe("func NewServer(addr, opts ...) {");
  });

  test("方法：接收者与结果类型擦除；带初始化的 err 判断保留", async () => {
    const src = `func (s *Server) Start() error {
	if err := s.listen(); err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	return nil
}
`;
    const out = await simplify(goProfile, src);
    expect(out[0]).toBe("func (s) Start() {");
    expect(out[1]).toBe("\tif err := s.listen(); err != nil {");
  });

  test("if err != nil { return } 折叠为单行标记", async () => {
    const src = `func (s *Server) Stop() error {
	err := s.close()
	if err != nil {
		return err
	}
	return nil
}
`;
    const out = await simplify(goProfile, src);
    expect(out[2]).toBe("\tif err: return");
    expect(out[3]).toBe("");
    expect(out[4]).toBe("");
    expect(out[5]).toBe("\treturn nil");
  });

  test("if err 折叠保留非平凡返回值（错误包装信息）", async () => {
    const src = `func (s *Server) Stop() error {
	if err != nil {
		return fmt.Errorf("stop: %w", err)
	}
	return nil
}
`;
    const out = await simplify(goProfile, src);
    expect(out[1]).toBe('\tif err: return fmt.Errorf("stop: %w", err)');
    expect(out[2]).toBe("");
  });

  test("if err 折叠截断不切断字符串字面量（未闭合引号会破坏高亮）", async () => {
    const src = `func run() error {
	if err != nil {
		return &exitStatusError{code: 1, msg: fmt.Sprintf("doctor failed: %v and then some more text here", err)}
	}
	return nil
}
`;
    const out = await simplify(goProfile, src);
    const line = out[1]!;
    expect(line.startsWith("\tif err: return")).toBe(true);
    expect(line.endsWith("…")).toBe(true);
    expect((line.match(/"/g) ?? []).length % 2).toBe(0); // 引号必须成对
  });

  test("结构体字段类型擦除但 tag 保留（tag 是线协议）", async () => {
    const src = `type Server struct {
	addr string \`json:"addr"\`
	count int
}
`;
    const out = await simplify(goProfile, src);
    expect(out[1]).toBe('\taddr `json:"addr"`');
    expect(out[2]).toBe("\tcount");
  });
});

describe("go 声明收集与折叠", () => {
  test("collect：方法以接收者类型为容器", async () => {
    const src = `package main

type Server struct{}

func NewServer() *Server { return nil }

func (s *Server) Start() {}
`;
    const tree = await parseSource("go", src);
    const decls = goProfile.collect(tree.rootNode);
    const start = decls.find((d) => d.name === "Start");
    expect(start?.container).toBe("Server");
    expect(start?.kind).toBe("function");
    expect(decls.find((d) => d.name === "Server")?.kind).toBe("type");
  });

  test("viewRows：import 分组与类型声明折叠", async () => {
    const src = `package main

import (
	"fmt"
	"strings"
)

type Server struct {
	addr string
	mux  int
}

type Handler interface {
	ServeHTTP(w ResponseWriter, r *Request) error
}

func main() {}
`;
    const rows = await viewRows(goProfile, src);
    const folds = rows.filter((r) => r.kind === "fold");
    expect(folds.map((f) => f.kind === "fold" && f.text)).toEqual([
      "import × 2（fmt、strings）",
      "type Server struct { addr, mux }",
      "type Handler interface { ServeHTTP }",
    ]);
    expect(rows[rows.length - 1]).toMatchObject({ kind: "line", text: "func main() {}" });
  });
});

describe("gdscript 简化器", () => {
  test("类型标注与返回类型擦除", async () => {
    const src = `extends Node2D
class_name FreeCell

const SUITS: Array = ["S", "H", "D", "C"]
var cells: Array = []

func move_card(card: Node2D, dest: Vector2) -> bool:
	var ok: bool = _check(card)
	return ok
`;
    const out = await simplify(gdscriptProfile, src);
    expect(out[3]).toBe('const SUITS = ["S", "H", "D", "C"]');
    expect(out[4]).toBe("var cells = []");
    expect(out[6]).toBe("func move_card(card, dest):");
    expect(out[7]).toBe("\tvar ok = _check(card)");
  });
});

describe("gdscript 声明收集与折叠", () => {
  test("collect：函数/变量/信号/enum", async () => {
    const src = `extends Node2D

signal card_moved(card)

var cells: Array = []

func move_card(card):
	pass
`;
    const tree = await parseSource("gdscript", src);
    const decls = gdscriptProfile.collect(tree.rootNode);
    const names = decls.map((d) => `${d.kind}:${d.name}`).sort();
    expect(names).toEqual(["function:move_card", "variable:card_moved", "variable:cells"]);
  });

  test("viewRows：enum 折叠保留成员名", async () => {
    const src = `extends Node2D

enum State { IDLE, DRAGGING, DEALING }

var state = State.IDLE
`;
    const rows = await viewRows(gdscriptProfile, src);
    const fold = rows.find((r) => r.kind === "fold");
    expect(fold).toMatchObject({ kind: "fold", text: "enum State { IDLE, DRAGGING, DEALING }" });
  });
});
