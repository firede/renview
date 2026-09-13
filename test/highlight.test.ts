import { describe, expect, test } from "bun:test";
import { parseDiff } from "react-diff-view";
import {
  highlightDiff,
  highlightSparseLines,
  highlightSimplifiedRows,
  highlightText,
} from "../web/src/highlight-core";

function diffAt(line: number) {
  return parseDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -${line},2 +${line},2 @@
 const shared = true;
-const value = 1;
+const value = 2;
`)[0]!;
}

describe("稀疏 diff 高亮", () => {
  test("百万行文件末尾的少量变更只高亮实际内容并保留行号", async () => {
    const far = await highlightDiff(diffAt(1_000_000).hunks, "typescript", "dark", "deterministic");
    const near = await highlightDiff(diffAt(1).hunks, "typescript", "dark", "deterministic");
    expect(Object.keys(far.old)).toHaveLength(2);
    expect(Object.keys(far.new)).toHaveLength(2);
    expect(far.old[999_999]).toEqual(near.old[0]);
    expect(far.old[1_000_000]).toEqual(near.old[1]);
    expect(far.new[1_000_000]).toEqual(near.new[1]);
    expect(far.old[0]).toBeUndefined();
  });

  test("多 hunk 的两侧行号偏移与增删内容各自正确", async () => {
    const f = parseDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -2,1 +2,2 @@
 const shared = true;
+const added = 1;
@@ -100,1 +101,1 @@
-const old = 2;
+const next = 3;
`)[0]!;
    const tokens = await highlightDiff(f.hunks, "typescript", "light", "deterministic");
    const text = (nodes: (typeof tokens.old)[number]) => nodes?.map((n) => n.value).join("");
    expect(text(tokens.old[99])).toBe("const old = 2;");
    expect(text(tokens.new[100])).toBe("const next = 3;");
    expect(text(tokens.new[2])).toBe("const added = 1;");
    expect(tokens.old[2]).toBeUndefined();
  });
});

test("简化行高亮保留两侧内容，折叠缺口与删除行不污染新增代码", async () => {
  const oldCode = '  upgradeManualHint: "Manual upgrade",';
  const newCode = "  upgradeManualHint: `Manual upgrade: ${INSTALL_CMD}`,";
  const tokens = await highlightSimplifiedRows(
    [
      { kind: "ctx", text: "/**", oldLn: 1, newLn: 1 },
      { kind: "ctx", text: " * English copy", oldLn: 2, newLn: 2 },
      { kind: "fold", count: 1, oldLines: [" */"], newLines: [" */"], oldLns: [3], newLns: [3] },
      { kind: "del", text: oldCode, oldLn: 51 },
      { kind: "del", text: "/* removed comment", oldLn: 52 },
      { kind: "add", text: newCode, newLn: 52 },
      { kind: "add", text: "const value = 1;", newLn: 53 },
    ],
    "typescript",
    "light",
    "deterministic",
  );
  expect(tokens.old[50]?.map((t) => t.content).join("")).toBe(oldCode);
  expect(tokens.new[51]?.map((t) => t.content).join("")).toBe(newCode);
  expect(new Set(tokens.new[51]!.map((t) => t.color)).size).toBeGreaterThan(1);
  expect(new Set(tokens.new[52]!.map((t) => t.color)).size).toBeGreaterThan(1);
  expect(tokens.old[2]).toBeUndefined();
  expect(tokens.new[2]).toBeUndefined();
});

test("连续行保留跨行注释状态", async () => {
  const source = ["/**", " * English copy", " */", "const value = 1;"];
  const tokens = await highlightSparseLines(
    new Map(source.map((line, i) => [i + 10, line])),
    "typescript",
    "dark",
    "deterministic",
  );
  const expected = await highlightText(source.join("\n"), "typescript", "dark", "deterministic");
  expect(tokens.slice(9)).toEqual(expected!);
});

test("常见源码与配置按文件名选择语法，明暗主题均保留文本并实际着色", async () => {
  const { shikiLangForPath } = await import("../web/src/langForPath");
  const samples = [
    ["Dockerfile", "docker", 'FROM alpine:3\nRUN echo "hello"'],
    ["app/Dockerfile.dev", "docker", "FROM alpine:3\nWORKDIR /app"],
    ["build/api.dockerfile", "docker", "FROM alpine:3\nCOPY . /app"],
    ["dockerfile", "docker", "FROM alpine:3\nEXPOSE 8080"],
    ["db/migrations/001.sql", "sql", "CREATE TABLE orders (id INTEGER PRIMARY KEY);"],
    ["queries/Orders.SQL", "sql", "SELECT * FROM orders WHERE status = 'paid';"],
    ["src/Order.java", "java", "public record Order(String id) {}"],
    ["pom.xml", "xml", "<project><version>1.0</version></project>"],
    ["layout.fxml", "xml", '<Label text="Hello" />'],
    ["schema.xsd", "xml", '<xs:element name="order" />'],
    ["build.gradle", "groovy", "plugins { id 'java' }"],
    ["settings.gradle.kts", "kotlin", 'rootProject.name = "shop"'],
    ["src/Build.groovy", "groovy", 'def name = "shop"'],
    ["src/Build.kt", "kotlin", 'val name = "shop"'],
    ["gradle.properties", "properties", "# JVM\norg.gradle.jvmargs=-Xmx2g"],
    ["gradlew", "bash", '#!/bin/sh\necho "$JAVA_HOME"'],
    ["mvnw", "bash", '#!/bin/sh\necho "$JAVA_HOME"'],
    ["gradlew.bat", "batch", "@echo off\nset JAVA_HOME=C:\\Java"],
    ["mvnw.cmd", "batch", "@echo off\nset JAVA_HOME=C:\\Java"],
    [".gitignore", "ignore", "# 注释\n!important.txt\n*.log\nbuild/"],
    [".gitattributes", "ignore", "*.png binary\n*.ts text eol=lf"],
    [".npmignore", "ignore", "# 产物\ndist/\n*.map"],
    [".gitmodules", "ini", '[submodule "lib"]\npath = lib\nurl = ../lib.git'],
  ];
  for (const [path, lang, source] of samples) {
    expect(shikiLangForPath(path)).toBe(lang!);
    for (const theme of ["light", "dark"] as const) {
      const tokens = await highlightText(source!, lang!, theme, "deterministic");
      expect(tokens?.map((line) => line.map((t) => t.content).join("")).join("\n")).toBe(source!);
      expect(new Set(tokens!.flat().map((t) => t.color)).size).toBeGreaterThan(1);
    }
  }
});

test("Apple 工程与源码文件按语法着色，原文在明暗主题中保持完整", async () => {
  const { shikiLangForPath } = await import("../web/src/langForPath");
  const samples = [
    ["Store.swift", "swift", '@MainActor final class Store { var title = "你好" }'],
    ["Store.swiftinterface", "swift", "public func load(id: Int) async throws -> Item"],
    [
      "Store.m",
      "objective-c",
      "@interface Store : NSObject\n@property (nonatomic, copy) NSString *title;\n@end",
    ],
    ["Store.mm", "objective-cpp", "#include <vector>\n@implementation Store\n@end"],
    ["Bridge.h", "c", "@interface Store : NSObject\n@end"],
    ["Core.h", "c", "int load(void);"],
    ["Core.hpp", "cpp", "template<class T> struct Box { T value; };"],
    ["Shaders.metal", "cpp", "#include <metal_stdlib>\nusing namespace metal;"],
    ["Info.plist", "xml", "<plist><dict><key>Name</key><string>App</string></dict></plist>"],
    [
      "App.entitlements",
      "xml",
      "<plist><dict><key>com.apple.security.app-sandbox</key><true/></dict></plist>",
    ],
    [
      "PrivacyInfo.xcprivacy",
      "xml",
      "<plist><dict><key>NSPrivacyTracking</key><false/></dict></plist>",
    ],
    ["Main.storyboard", "xml", "<document><scenes/></document>"],
    ["Main.xib", "xml", "<document><objects/></document>"],
    ["App.xcscheme", "xml", '<Scheme version="1.3"/>'],
    ["contents.xcworkspacedata", "xml", '<Workspace version="1.0"/>'],
    ["Localizable.stringsdict", "xml", "<plist><dict/></plist>"],
    ["Localizable.xcstrings", "json", '{"sourceLanguage":"en","strings":{}}'],
    ["App.xctestplan", "json", '{"version":1,"testTargets":[]}'],
    ["Package.resolved", "json", '{"pins":[],"version":3}'],
    ["Assets.xcassets/Contents.json", "json", '{"info":{"version":1}}'],
    [
      "App.xcodeproj/project.pbxproj",
      "openstep",
      "// !$*UTF8*$!\n{ objects = { ABC123 /* App */ = { isa = PBXGroup; children = (); }; }; }",
    ],
    ["Localizable.strings", "apple-strings", '/* 翻译 */\n"greeting" = "Hello %@, %1$d \\n";'],
    [
      "Debug.xcconfig",
      "xcconfig",
      '#include? "Base.xcconfig"\nOTHER_LDFLAGS[sdk=iphoneos*] = $(inherited) -ObjC',
    ],
    ["Podfile", "ruby", 'platform :ios, "17.0"'],
    ["App.podspec", "ruby", 'Pod::Spec.new do |s|\n s.name = "App"\nend'],
    ["Fastfile", "ruby", 'lane :beta do\n build_app(scheme: "App")\nend'],
    ["Podfile.lock", "yaml", "PODS:\n  - App (1.0)"],
  ];
  for (const [path, lang, source] of samples) {
    expect(shikiLangForPath(path)).toBe(lang!);
    for (const theme of ["light", "dark"] as const) {
      const tokens = await highlightText(source!, lang!, theme, "deterministic");
      expect(tokens?.map((line) => line.map((t) => t.content).join("")).join("\n")).toBe(source!);
      expect(new Set(tokens!.flat().map((t) => t.color)).size).toBeGreaterThan(1);
    }
  }
  expect(shikiLangForPath("Inputs.xcfilelist")).toBeNull();
});

test("Godot 工程与源码文件按语法着色，原文在明暗主题中保持完整", async () => {
  const { shikiLangForPath, resolveHighlightLanguage } = await import("../web/src/langForPath");
  const samples = [
    ["scripts/Player.gd", "gdscript", "extends CharacterBody2D\nfunc _ready() -> void:\n\tpass"],
    [
      "shaders/water.gdshader",
      "gdshader",
      "shader_type spatial;\nuniform vec4 color : source_color;\nvoid fragment() { ALBEDO = color.rgb; }",
    ],
    [
      "shaders/common.gdshaderinc",
      "gdshader",
      "float saturate(float v) { return clamp(v, 0.0, 1.0); }",
    ],
    [
      "scenes/Main.tscn",
      "gdresource",
      '[gd_scene load_steps=2 format=3 uid="uid://abc"]\n\n[node name="Main" type="Node2D"]\nposition = Vector2(1, 2)',
    ],
    [
      "data/Default.tres",
      "gdresource",
      '[gd_resource type="Theme" format=3]\n\n[resource]\ndefault_font_size = 16',
    ],
    [
      "project.godot",
      "gdresource",
      '[application]\nconfig/name="Game"\nrun/main_scene="res://Main.tscn"',
    ],
    ["icon.png.import", "ini", '[remap]\nimporter="texture"\ntype="CompressedTexture2D"'],
    ["extension/libfoo.gdextension", "ini", '[configuration]\nentry_symbol = "foo_init"'],
    ["export_presets.cfg", "ini", '[preset.0]\nname="macOS"'],
    [".editorconfig", "ini", "root = true\n[*.gd]\nindent_style = tab"],
    ["locale/zh.po", "po", 'msgid "Hello"\nmsgstr "你好"'],
    ["locale/messages.pot", "po", 'msgid "Hello"\nmsgstr ""'],
    ["scripts/Player.cs", "csharp", "using Godot;\npublic partial class Player : Node2D { }"],
    ["Game.csproj", "xml", '<Project Sdk="Godot.NET.Sdk/4.3.0"></Project>'],
  ];
  for (const [path, lang, source] of samples) {
    expect(shikiLangForPath(path)).toBe(lang!);
    for (const theme of ["light", "dark"] as const) {
      const tokens = await highlightText(source!, lang!, theme, "deterministic");
      expect(tokens?.map((line) => line.map((t) => t.content).join("")).join("\n")).toBe(source!);
      expect(new Set(tokens!.flat().map((t) => t.color)).size).toBeGreaterThan(1);
    }
  }
  // .shader 歧义：Unity ShaderLab 与 Godot shader 按内容区分
  expect(
    resolveHighlightLanguage("shaderlab", "shader_type canvas_item;\nvoid fragment() {}"),
  ).toBe("gdshader");
  expect(resolveHighlightLanguage("shaderlab", 'Shader "Custom/X" {\nCGPROGRAM\nENDCG\n}')).toBe(
    "shaderlab",
  );
  expect(resolveHighlightLanguage("gdshader", 'Shader "Legacy/X" {\nCGPROGRAM\nENDCG\n}')).toBe(
    "shaderlab",
  );
  expect(resolveHighlightLanguage("gdshader", "shader_type spatial;")).toBe("gdshader");
});

test("Apple 格式多行注释、变量、占位符和格式推断保留上下文", async () => {
  const { resolveHighlightLanguage } = await import("../web/src/langForPath");
  expect(resolveHighlightLanguage("c", "@interface A\nstd::vector<int> values;")).toBe(
    "objective-cpp",
  );
  expect(resolveHighlightLanguage("c", "namespace A {} ")).toBe("cpp");
  expect(resolveHighlightLanguage("c", "class Box {\npublic:\n  int value;\n};")).toBe("cpp");
  expect(resolveHighlightLanguage("c", 'extern "C" {\nint load(void);\n}')).toBe("cpp");
  expect(resolveHighlightLanguage("c", "typedef struct { int x; } Point;")).toBe("c");
  expect(
    resolveHighlightLanguage("objective-c", "function y = f(x)\n% 注释\ny = x + 1;\nend"),
  ).toBe("matlab");
  expect(resolveHighlightLanguage("objective-c", "@interface A : NSObject\n@end")).toBe(
    "objective-c",
  );
  expect(resolveHighlightLanguage("objective-c", "int add(int a, int b) { return a + b; }")).toBe(
    "objective-c",
  );
  expect(resolveHighlightLanguage("xml", "/* 属性 */ { name = App; }")).toBe("openstep");
  expect(resolveHighlightLanguage("apple-strings", '<?xml version="1.0"?><plist/>')).toBe("xml");
  for (const lang of ["openstep", "apple-strings", "xcconfig"]) {
    const lines = ["/* 注释", "跨行注释 */", '"name" = "Hello %@";'];
    const tokens = await highlightSparseLines(
      new Map(lines.map((line, i) => [i + 20, line])),
      lang,
      "dark",
      "deterministic",
    );
    const full = await highlightText(lines.join("\n"), lang, "dark", "deterministic");
    expect(tokens.slice(19)).toEqual(full!);
  }
});
