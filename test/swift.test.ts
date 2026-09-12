import { describe, expect, test } from "bun:test";
import parseDiff from "parse-diff";
import { swiftProfile } from "../src/analysis/langs/swift";
import { profileForPath } from "../src/analysis/langs";
import { parseSource } from "../src/analysis/parser";
import { simplifySource } from "../src/analysis/simplify";
import { analyzeFile, viewerFile } from "../src/analysis/service";
import type { ParsedFile } from "../src/analysis/map";

const simplify = (source: string) =>
  simplifySource({ grammarFile: "swift", simplify: swiftProfile.simplify! }, source);
async function change(old: string, next: string) {
  const diff = `diff --git a/Store.swift b/Store.swift\n--- a/Store.swift\n+++ b/Store.swift\n@@ -1,${old.split("\n").length} +1,${next.split("\n").length} @@\n${old
    .split("\n")
    .map((s) => `-${s}`)
    .join("\n")}\n${next
    .split("\n")
    .map((s) => `+${s}`)
    .join("\n")}\n`;
  return analyzeFile(parseDiff(diff)[0] as unknown as ParsedFile, old, next, "zh-CN");
}

describe("Swift 业务投影", () => {
  test("简化声明噪声与重复局部类型，保留模型、状态及执行边界", async () => {
    const source = `@MainActor
@Observable
public final class Store {
  private(set) var status: Status = .ready
  private var items: [Item] = []
  @discardableResult
  public func load(id: Int) async throws -> Item {
    let item: Item = Item(id: id)
    let status: Status = .ready
    let items: [Item] = []
    defer { audit() }
    try await save(item)
    return item
  }
}`;
    const out = await simplify(source);
    expect(out.lines.join("\n")).toBe(
      source
        .replace("public ", "")
        .replace("private var", "var")
        .replace("  @discardableResult", "")
        .replace("public func", "func")
        .replace("let item: Item", "let item"),
    );
    expect(out.lines).toHaveLength(source.split("\n").length);
    expect(out.erasures[7]!.map((e) => e.original).join("")).toBe(": Item");
  });

  test("SwiftUI 结构、包装器、生命周期、可用性和未知宏完整保留", async () => {
    const source = `import SwiftUI
@available(iOS 17, *)
struct Screen: View {
  @State var count = 0
  @Binding var enabled: Bool
  @Environment(\\.dismiss) var dismiss
  var body: some View {
    VStack {
      if enabled { Text("启用") }
      ForEach(0..<count, id: \\.self) { i in Text("\\(i)") }
      Button("完成") { dismiss() }
    }
    .task { await refresh() }
    .onChange(of: count) { old, next in audit(next) }
  }
}
#Preview { Screen(enabled: .constant(true)) }
class Owner {
  weak var delegate: Delegate?
  func run() {
    callback { [weak self] in
      guard let self else { return }
      self.update()
    }
  }
}`;
    expect((await simplify(source)).lines.join("\n")).toBe(source);
  });

  test("声明覆盖协议、枚举、计算属性、观察器、初始化器、下标和受约束扩展", async () => {
    const source = `protocol Repository {
 associatedtype Item
 var value: Item { get }
 func load(id: Int) -> Item
}
enum State { case ready, failed(String) }
struct Store<T> {
 var value: Int = 0 { didSet { audit() } }
 var body: some View { Text("hi") }
 init(id: Int) { value = id }
 subscript(index: Int) -> Int { value + index }
}
extension Store where T: Codable { func load(id: Int) {} }
extension Store where T: Equatable { func load(id: Int) {} }
actor Worker { func run() async {} }
class Owner { deinit { cleanup() } }
@freestanding(expression)
macro stringify<T>(_ value: T) -> String = #externalMacro(module: "Macros", type: "Stringify")`;
    const tree = await parseSource("swift", source);
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const declarations = swiftProfile.collect(tree.rootNode, "zh-CN");
      expect(declarations.map((d) => d.name)).toEqual(
        expect.arrayContaining([
          "Repository",
          "Item",
          "value",
          "load(id:)",
          "ready, failed",
          "body",
          "init(id:)",
          "subscript(_:)",
          "Worker",
          "deinit()",
          "stringify",
        ]),
      );
      expect(declarations.filter((d) => d.name === "load(id:)").map((d) => d.container)).toEqual([
        "Repository",
        "extension Store where T: Codable",
        "extension Store where T: Equatable",
      ]);
      expect(declarations.find((d) => d.name === "body")?.bodyNode?.type).toBe("computed_property");
      expect(
        declarations.find((d) => d.name === "value" && d.container === "Store")?.bodyNode?.type,
      ).toBe("willset_didset_block");
    } finally {
      tree.delete();
    }
  });

  test("插入和重排同标签重载不误报其他函数，剩余重载仍识别签名变化", async () => {
    const a = "func load(id: Int) { use(id) }";
    const b = "func load(id: String) { use(id) }";
    const result = await change(`${a}\n${b}`, `func load(id: UUID) { use(id) }\n${b}\n${a}`);
    expect(result.projection?.units.map((u) => [u.name, u.change])).toEqual([
      ["load(id:)", "added"],
    ]);
    const edited = await change(`${a}\n${b}`, `${a}\n${b.replace("String", "Substring")}`);
    expect(edited.projection?.units.map((u) => u.change)).toEqual(["signature"]);
  });

  test("计算属性变化属于正文，属性和枚举成员增减有结构摘要", async () => {
    const body = await change(
      'struct Screen { var body: some View { Text("a") } }',
      'struct Screen { var body: some View { Text("b") } }',
    );
    expect(body.projection?.units.find((u) => u.name === "body")?.change).toBe("body");
    for (const [old, next, member] of [
      ["struct Store { var id: Int }", "struct Store { var id: Int; var title: String }", "title"],
      ["enum State { case ready }", "enum State { case ready, failed(String) }", "failed"],
    ]) {
      const result = await change(old!, next!);
      expect(result.projection?.units.some((u) => u.domain?.added.includes(member!))).toBe(true);
      expect(
        result.simplified?.rows.some((r) => r.kind === "add" && r.text.includes(member!)),
      ).toBe(true);
    }
  });

  test("条件编译与宏变化不丢失，单独擦除的变化仍可从折叠还原", async () => {
    const source =
      '#if os(iOS)\nimport UIKit\n#else\nimport AppKit\n#endif\n#Preview { Text("a") }';
    const result = await change(
      source,
      source.replace('"a"', '"b"').replace("os(iOS)", "os(macOS)"),
    );
    expect(result.degradedReason).toBeUndefined();
    expect(
      result.simplified?.rows.some((r) => r.kind === "add" && r.text.includes("os(macOS)")),
    ).toBe(true);
    expect(
      result.simplified?.rows.some((r) => r.kind === "add" && r.text.includes("#Preview")),
    ).toBe(true);
    const visibility = await change("public struct A {}", "private struct A {}");
    expect(visibility.simplified?.stats.visible).toBe(0);
    expect(
      visibility.simplified?.rows.some(
        (r) =>
          r.kind === "fold" &&
          r.oldLines.includes("public struct A {}") &&
          r.newLines.includes("private struct A {}"),
      ),
    ).toBe(true);
  });

  test("浏览折叠普通 imports，协议不折叠，语法错误回退原文", async () => {
    expect(profileForPath("Store.SWIFT")?.id).toBe("swift");
    expect(profileForPath("Store.swiftinterface")).toBeNull();
    const view = await viewerFile(
      "Store.swift",
      "import Foundation\nimport SwiftUI\nprotocol Store { func load() }",
      "zh-CN",
    );
    expect(view.view?.filter((r) => r.kind === "fold")).toHaveLength(1);
    expect(view.view?.some((r) => r.kind === "line" && r.text.includes("protocol"))).toBe(true);
    const invalid = await viewerFile("Store.swift", "struct Store { func broken(", "zh-CN");
    expect(invalid.degradedReason).toBe("parse-error");
    expect(invalid.simplified).toBeNull();
  });
});

test("Swift 连续解析不串入 raw string 或宏 scanner 状态", async () => {
  const sources = [
    'let message = ##"原始字符串 \\##(value)"##',
    '#if os(iOS)\nimport UIKit\n#endif\n#Preview { Text("hi") }',
    "@Model final class Item { @Attribute(.unique) var id: UUID\n @Relationship(deleteRule: .cascade) var children: [Item] }",
  ];
  for (let round = 0; round < 3; round++) {
    for (const source of sources) {
      expect((await simplify(source)).lines.join("\n")).toBe(source);
    }
  }
});

test("新语法超出 grammar 覆盖时回退原文，同行 import 不折叠声明", async () => {
  for (const source of [
    "func load() throws(LoadError) { throw .failed }",
    "nonisolated(nonsending) func load() async {}",
  ]) {
    const view = await viewerFile("Store.swift", source, "zh-CN");
    expect(view.source).toBe(source);
    expect(view.simplified).toBeNull();
    expect(view.degradedReason).toBe("parse-error");
  }
  const view = await viewerFile("Store.swift", "import Foundation; struct Item {}", "zh-CN");
  expect(view.view?.some((r) => r.kind === "line" && r.text.includes("struct Item"))).toBe(true);
});
