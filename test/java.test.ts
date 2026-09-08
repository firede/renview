import { describe, expect, test } from "bun:test";
import parseDiff from "parse-diff";
import { javaProfile } from "../src/analysis/langs/java";
import { profileForPath } from "../src/analysis/langs";
import { parseSource } from "../src/analysis/parser";
import { simplifySource } from "../src/analysis/simplify";
import { analyzeFile, viewerFile } from "../src/analysis/service";
import type { ParsedFile } from "../src/analysis/map";

const simplify = (source: string) =>
  simplifySource({ grammarFile: "java", simplify: javaProfile.simplify! }, source);

async function change(old: string, next: string) {
  const diff = `diff --git a/Order.java b/Order.java\n--- a/Order.java\n+++ b/Order.java\n@@ -1,${old.split("\n").length} +1,${next.split("\n").length} @@\n${old
    .split("\n")
    .map((s) => `-${s}`)
    .join("\n")}\n${next
    .split("\n")
    .map((s) => `+${s}`)
    .join("\n")}\n`;
  return analyzeFile(parseDiff(diff)[0] as unknown as ParsedFile, old, next, "zh-CN");
}

describe("Java 业务投影", () => {
  test("保留模型、边界类型与业务注解，简化局部实现细节且逐行可还原", async () => {
    const source = `package shop;
import java.util.List;
@Entity
public final class Order implements Payable {
  @OneToMany
  private final List<OrderLine> lines = new ArrayList<>();
  @Transactional
  public Money total(final Currency currency) throws IOException {
    final Money 合计 = calculate(lines, currency);
    return 合计;
  }
}`;
    const out = await simplify(source);
    expect(out.lines).toEqual([
      "package shop;",
      "import java.util.List;",
      "@Entity",
      "final class Order implements Payable {",
      "  @OneToMany",
      "  final List<OrderLine> lines = new ArrayList<>();",
      "  @Transactional",
      "  Money total(Currency currency) {",
      "    var 合计 = calculate(lines, currency);",
      "    return 合计;",
      "  }",
      "}",
    ]);
    expect(out.erasures[8]!.map((e) => e.original).join("")).toBe("final Money");
    expect(out.erasures[7]!.map((e) => e.original).join("")).toContain("throws IOException");
  });

  test("字段访问压缩保留实际映射，校验与注释不压缩", async () => {
    const source = `class Order {
  Money total;
  Money getTotal() {
    return this.total;
  }
  void setTotal(Money amount) {
    this.total = amount;
  }
  void checked(Money amount) {
    if (amount.isNegative()) throw new IllegalArgumentException();
    this.total = amount;
  }
  Money documented() {
    // 使用结算金额
    return this.total;
  }
}`;
    const out = await simplify(source);
    expect(out.lines[2]).toBe("  Money getTotal() =>");
    expect(out.lines[3]).toBe("    return this.total;");
    expect(out.lines[5]).toBe("  void setTotal(Money amount) =>");
    expect(out.lines[6]).toBe("    this.total = amount;");
    expect(out.lines[9]).toContain("if (amount.isNegative()) throw");
    expect(out.lines[13]).toBe("    // 使用结算金额");
    expect(out.lines).toHaveLength(source.split("\n").length);
    expect(out.erasures[4]![0]!.original).toBe("}");
  });

  test("只收起标准编译器注解，框架和未知注解继续可见", async () => {
    const source = `class Order {
  @Override
  @java.lang.SuppressWarnings("unchecked")
  @Transactional
  @JsonProperty("total")
  @custom.Override
  public Money total() { return calculate(); }
}`;
    const out = await simplify(source);
    expect(out.lines.slice(1, 6)).toEqual([
      "",
      "",
      "  @Transactional",
      '  @JsonProperty("total")',
      "  @custom.Override",
    ]);
    expect(out.erasures[1]![0]!.original).toBe("@Override");
  });

  test("保留 record 约束、sealed 层次、接口、枚举行为、异常分支与资源管理", async () => {
    const source = `sealed interface Payment permits Cash {
  Money amount();
  default boolean valid() { return amount().isPositive(); }
}
record Cash(@NotNull Money amount) implements Payment {
  Cash { if (amount.isNegative()) throw new IllegalArgumentException(); }
}
enum State {
  OPEN, PAID;
  boolean terminal() { return this == PAID; }
}
class Reader {
  synchronized String read() throws IOException {
    try (InputStream input = open()) {
      return switch (input.read()) { case 0 -> "empty"; default -> "data"; };
    } catch (IOException | IllegalStateException error) {
      throw new DomainException(error);
    } finally { audit(); }
  }
}`;
    const out = await simplify(source);
    expect(out.lines.join("\n")).toBe(source.replace(" throws IOException", ""));
  });

  test("字段、record 组件、集合关系和注解的变化直接可见", async () => {
    for (const [old, next] of [
      ["record Order(Money amount) {}", "record Order(Money amount, Currency currency) {}"],
      ["class Order { Money total; }", "class Order { Money total; Currency currency; }"],
      ["class Order { OrderLine lines; }", "class Order { List<OrderLine> lines; }"],
      ["class Order { @Min(1) int count; }", "class Order { @Min(2) int count; }"],
      ["enum State { OPEN, PAID }", "enum State { OPEN, PAID, REFUNDED }"],
    ]) {
      const result = await change(old!, next!);
      expect(result.simplified?.rows.some((r) => r.kind === "add" && r.text === next)).toBe(true);
      if (next!.includes("currency"))
        expect(result.projection?.units.some((u) => u.domain?.added.includes("currency"))).toBe(
          true,
        );
      if (next!.includes("REFUNDED"))
        expect(result.projection?.units.some((u) => u.domain?.added.includes("REFUNDED"))).toBe(
          true,
        );
    }
  });

  test("局部类型变化折叠，字段映射变化可见", async () => {
    const local = await change(
      "class Order { void run() { Money x = total(); } }",
      "class Order { void run() { BigDecimal x = total(); } }",
    );
    expect(local.simplified?.stats.visible).toBe(0);
    expect(local.simplified?.stats.folded).toBeGreaterThan(0);
    const old = `class Order {
  Money total() {
    return this.subtotal;
  }
}`;
    const result = await change(old, old.replace("this.subtotal", "this.grandTotal"));
    expect(
      result.simplified?.rows.some((r) => r.kind === "add" && r.text.includes("this.grandTotal")),
    ).toBe(true);
  });

  test("局部 diff 的字段变更不因访问方法压缩而搬到未变更的签名行", async () => {
    const old = "class Order {\n  Money total;\n  Money total() {\n    return total;\n  }\n}";
    const next = old.replace("return total;", "return this.subtotal;");
    const diff = `diff --git a/Order.java b/Order.java
--- a/Order.java
+++ b/Order.java
@@ -3,3 +3,3 @@
   Money total() {
-    return total;
+    return this.subtotal;
   }
`;
    const result = await analyzeFile(
      parseDiff(diff)[0] as unknown as ParsedFile,
      old,
      next,
      "zh-CN",
    );
    expect(
      result.simplified?.rows.some((r) => r.kind === "del" && r.text.includes("return total;")),
    ).toBe(true);
    expect(
      result.simplified?.rows.some(
        (r) => r.kind === "add" && r.text.includes("return this.subtotal;"),
      ),
    ).toBe(true);
    expect((await simplify(old)).lines[2]).toBe("  Money total() =>");
  });

  test("保留类型注解、未初始化类型、数组维度与计算，只删显式调用类型参数", async () => {
    const source = `class Order {
  void run() {
    Money pending;
    List<@NotNull Money> amounts = load();
    int counts[] = {1, 2};
    Money value = (Money) raw;
    boolean ok = raw instanceof Money;
    this.<Money>convert(raw);
  }
}`;
    const lines = (await simplify(source)).lines;
    expect(lines[2]).toBe("    Money pending;");
    expect(lines[3]).toBe("    List<@NotNull Money> amounts = load();");
    expect(lines[4]).toBe("    var counts[] = {1, 2};");
    expect(lines[5]).toBe("    var value = (Money) raw;");
    expect(lines[6]).toBe("    var ok = raw instanceof Money;");
    expect(lines[7]).toBe("    this.convert(raw);");
  });

  test("声明收集区分嵌套类、构造器、重载、初始化块及枚举方法", async () => {
    const source = `class Order {
  static { register(); }
  { audit(); }
  Order() {}
  void submit() {}
  void submit(int count) {}
  class Item { void submit() {} }
  enum State { OPEN; boolean active() { return true; } }
}`;
    const tree = await parseSource("java", source);
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const declarations = javaProfile.collect(tree.rootNode, "zh-CN");
      expect(declarations.filter((d) => d.name === "submit").map((d) => d.container)).toEqual([
        "Order",
        "Order",
        "Order.Item",
      ]);
      expect(declarations.some((d) => d.name === "active" && d.container === "Order.State")).toBe(
        true,
      );
      expect(declarations.filter((d) => d.kind === "function")).toHaveLength(7);
    } finally {
      tree.delete();
    }
  });

  test("全文仅折叠 import，解析失败回退原文，生态文件不误启用 Java 简化", async () => {
    expect(profileForPath("src/Order.JAVA")?.id).toBe("java");
    expect(profileForPath("build.gradle.kts")).toBeNull();
    const view = await viewerFile(
      "Order.java",
      "import java.util.List;\nimport java.util.Map;\nrecord Order(Money total) {}",
      "en",
    );
    expect(view.degradedReason).toBeUndefined();
    expect(view.view?.filter((r) => r.kind === "fold")).toHaveLength(1);
    expect(view.view?.some((r) => r.kind === "line" && r.text.includes("record Order"))).toBe(true);
    const invalid = await viewerFile("Order.java", "class Order { void broken(", "zh-CN");
    expect(invalid.degradedReason).toBe("parse-error");
    expect(invalid.simplified).toBeNull();
  });
});
