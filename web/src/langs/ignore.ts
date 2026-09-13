import type { LanguageRegistration } from "shiki/core";

/**
 * gitignore/dockerignore 类通配清单与 gitattributes 属性行共用的词法着色：
 * 只标注注释、行首取反、通配符、目录分隔与属性赋值，不解释路径语义。
 */
export const ignore: LanguageRegistration = {
  name: "ignore",
  repository: {},
  scopeName: "source.ignore",
  patterns: [
    { name: "constant.character.escape", match: "\\\\." },
    { name: "comment.line.number-sign", match: "^[ \\t]*#.*$" },
    { name: "keyword.operator.negation", match: "^[ \\t]*!" },
    { name: "keyword.operator.glob", match: "\\*\\*|[*?]" },
    { name: "punctuation.section.brackets", begin: "\\[", end: "\\]|$" },
    { name: "punctuation.separator", match: "/" },
    { name: "keyword.operator", match: "[ \\t]-[A-Za-z_][A-Za-z0-9_-]*" },
    { name: "entity.other.attribute-name", match: "[ \\t][A-Za-z_][A-Za-z0-9_-]*(?==)" },
    { name: "keyword.operator.assignment", match: "=" },
  ],
};
