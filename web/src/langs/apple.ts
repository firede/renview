import type { LanguageRegistration } from "shiki/core";

// 三种格式只做词法着色，共享注释和字符串规则，不解释配置或改写原文。
const comments = [
  { name: "comment.line.double-slash", begin: "//", end: "$" },
  { name: "comment.block", begin: "/\\*", end: "\\*/" },
];
const quotedString = {
  name: "string.quoted.double",
  begin: '"',
  end: '"',
  patterns: [
    { name: "constant.character.escape", match: "\\\\(?:U[0-9a-fA-F]{4}|u[0-9a-fA-F]{4}|.)" },
    {
      name: "constant.other.placeholder",
      match:
        "%((?:[0-9]+\\$)?[-+#0 ]*[0-9]*(?:\\.[0-9]+)?(?:hh|ll|[hlztjL])?[@diuoxXfFeEgGaAcCsSp]|%)",
    },
  ],
};

export const openstep: LanguageRegistration = {
  name: "openstep",
  repository: {},
  scopeName: "source.openstep",
  patterns: [
    ...comments,
    quotedString,
    { name: "entity.other.attribute-name", match: "[A-Za-z0-9_./$<>-]+(?=\\s*=)" },
    { name: "constant.numeric", match: "\\b[0-9]+\\b" },
    { name: "keyword.operator.assignment", match: "=" },
    { name: "punctuation.separator", match: "[{}();,]" },
  ],
};

export const strings: LanguageRegistration = {
  name: "apple-strings",
  repository: {},
  scopeName: "source.apple-strings",
  patterns: [
    ...comments,
    quotedString,
    { name: "keyword.operator.assignment", match: "=" },
    { name: "punctuation.terminator", match: ";" },
  ],
};

export const xcconfig: LanguageRegistration = {
  name: "xcconfig",
  repository: {},
  scopeName: "source.xcconfig",
  patterns: [
    ...comments,
    { name: "keyword.control.directive", match: "^\\s*#include\\??\\b" },
    { name: "variable.other", match: "\\$\\([^)]+\\)|\\$\\{[^}]+\\}" },
    {
      name: "entity.other.attribute-name",
      match: "^[ \\t]*[A-Za-z_][A-Za-z0-9_]*(?=\\s*(?:\\[|=|\\+=|\\?=))",
    },
    {
      name: "string.quoted.double",
      begin: '"',
      end: '"',
      patterns: [{ name: "variable.other", match: "\\$\\([^)]+\\)|\\$\\{[^}]+\\}" }],
    },
    { name: "entity.other.attribute-name", match: "\\b(?:sdk|arch|config|variant)\\b(?==)" },
    { name: "keyword.operator.assignment", match: "[+?]?=" },
    { name: "punctuation.section", match: "[\\[\\]]" },
    { name: "constant.character.escape", match: "\\\\$" },
  ],
};
