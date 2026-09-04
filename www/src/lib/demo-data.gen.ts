// 由 scripts/gen-demo.ts 生成（bun run gen:demo），勿手改；新鲜度由 test/samples.test.ts 锁定

export interface DemoSeg {
  t: string;
  dc?: string;
  lc?: string;
  hl?: "a" | "d";
  e?: string;
  em?: "repl" | "adj" | "mark";
}

export interface DemoRowLine {
  k: "ctx" | "del" | "add";
  o?: number;
  n?: number;
  segs: DemoSeg[];
}

export interface DemoFoldLine {
  ln: number;
  segs: DemoSeg[];
}

export interface DemoRowFold {
  k: "fold";
  count: number;
  summary: string;
  olds: DemoFoldLine[];
  news: DemoFoldLine[];
}

export type DemoRow = DemoRowLine | DemoRowFold;

export interface DemoBadge {
  kind: string;
  label: string;
  count: number;
}

export interface DemoUnit {
  name: string;
  glyph: string;
  tag: string;
  tagKind: string;
  membersAdded: string[];
  membersRemoved: string[];
}

export interface DemoFile {
  path: string;
  additions: number;
  deletions: number;
  badges: DemoBadge[];
  units: DemoUnit[];
  simplified: DemoRow[];
  raw: DemoRowLine[];
}

export interface DemoChangeset {
  featured: string;
  files: DemoFile[];
}

export const demoData: { "zh-CN": DemoChangeset; en: DemoChangeset } = {
  "zh-CN": {
    "featured": "src/pricing.rs",
    "files": [
      {
        "path": "src/pricing.rs",
        "additions": 7,
        "deletions": 7,
        "badges": [
          {
            "kind": "signature",
            "label": "签名",
            "count": 1
          },
          {
            "kind": "type-only",
            "label": "类型",
            "count": 1
          }
        ],
        "units": [
          {
            "name": "total",
            "glyph": "ƒ",
            "tag": "签名",
            "tagKind": "signature",
            "membersAdded": [],
            "membersRemoved": []
          },
          {
            "name": "LineItem",
            "glyph": "T",
            "tag": "结构",
            "tagKind": "shape",
            "membersAdded": [
              "note"
            ],
            "membersRemoved": []
          }
        ],
        "simplified": [
          {
            "k": "ctx",
            "o": 1,
            "n": 1,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "struct",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 2,
            "n": 2,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "sku",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": String",
                "em": "adj"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "fold",
            "count": 1,
            "summary": "LineItem：price（类型/格式变更）",
            "olds": [
              {
                "ln": 3,
                "segs": [
                  {
                    "t": "    price",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": ":",
                    "dc": "#FF7B72",
                    "lc": "#CF222E"
                  },
                  {
                    "t": " ",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": "f64",
                    "dc": "#FFA657",
                    "lc": "#953800"
                  },
                  {
                    "t": ",",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              }
            ],
            "news": [
              {
                "ln": 3,
                "segs": [
                  {
                    "t": "    price",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": ":",
                    "dc": "#FF7B72",
                    "lc": "#CF222E"
                  },
                  {
                    "t": " ",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": "Decimal",
                    "dc": "#FFA657",
                    "lc": "#953800"
                  },
                  {
                    "t": ",",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              }
            ]
          },
          {
            "k": "add",
            "n": 4,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "note",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": Option<String>",
                "em": "adj"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 5,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": u32",
                "em": "adj"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 6,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 7,
            "segs": []
          },
          {
            "k": "del",
            "o": 7,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": &[LineItem]",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": Option<&Coupon>",
                "em": "adj"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "-> f64",
                "em": "mark"
              },
              {
                "t": "{",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 8,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "subtotal",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": f64",
                "em": "adj"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "d"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "sum",
                "dc": "#D2A8FF",
                "lc": "#8250DF",
                "hl": "d"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "match",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 10,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Some",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "d"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "c) ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "c",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": "percent ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "d"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              }
            ]
          },
          {
            "k": "del",
            "o": 11,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "None",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal,",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 12,
            "segs": [
              {
                "t": "    }",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 8,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": &[LineItem]",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": Option<&Coupon>",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "currency",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a",
                "e": ": &Currency",
                "em": "adj"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "-> Result<Decimal, PricingError>",
                "em": "mark"
              },
              {
                "t": "{",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ".into()",
                "em": "adj"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "fold",
                "dc": "#D2A8FF",
                "lc": "#8250DF",
                "hl": "a"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "a"
              },
              {
                "t": "::",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": "ZERO",
                "dc": "#79C0FF",
                "lc": "#0550AE",
                "hl": "a"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": "acc, x",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": " acc ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "+",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": " x",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": ");",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 10,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " discount ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "percent)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "unwrap_or_default",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 11,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " rate ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "exchange_rate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(currency)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "?",
                "em": "mark"
              },
              {
                "t": ";",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 12,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Ok",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "a"
              },
              {
                "t": "(subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "discount",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": " rate)",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 13,
            "n": 13,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ],
        "raw": [
          {
            "k": "ctx",
            "o": 1,
            "n": 1,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "struct",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 2,
            "n": 2,
            "segs": [
              {
                "t": "    sku",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "String",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 3,
            "segs": [
              {
                "t": "    price",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 3,
            "segs": [
              {
                "t": "    price",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 4,
            "segs": [
              {
                "t": "    note",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Option",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "String",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ">,",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 5,
            "segs": [
              {
                "t": "    qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "u32",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 6,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 7,
            "segs": []
          },
          {
            "k": "del",
            "o": 7,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "[",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "], coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Option",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Coupon",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ">) ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "->",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 8,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "sum",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "match",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 10,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Some",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "(c) ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "percent ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": "),",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 11,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "None",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal,",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 12,
            "segs": [
              {
                "t": "    }",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 8,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "[",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "], coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Option",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Coupon",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ">, currency",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Currency",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "->",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Result",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "PricingError",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "> {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "into",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "())",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "fold",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "::",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "ZERO",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "acc, x",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " acc ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "+",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " x);",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 10,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " discount ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "percent)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "unwrap_or_default",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 11,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " rate ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "exchange_rate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(currency)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "?",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": ";",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 12,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Ok",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "(subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " discount ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " rate)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 13,
            "n": 13,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ]
      },
      {
        "path": "src/notify.go",
        "additions": 4,
        "deletions": 0,
        "badges": [
          {
            "kind": "body",
            "label": "实现",
            "count": 1
          }
        ],
        "units": [
          {
            "name": "SendOrderConfirmation",
            "glyph": "ƒ",
            "tag": "实现",
            "tagKind": "body",
            "membersAdded": [],
            "membersRemoved": []
          }
        ],
        "simplified": [
          {
            "k": "ctx",
            "o": 3,
            "n": 3,
            "segs": [
              {
                "t": "import",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "fmt",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 4,
            "segs": []
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 5,
            "segs": [
              {
                "t": "func",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "SendOrderConfirmation",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "client",
                "dc": "#FFA657",
                "lc": "#953800",
                "e": " *Client",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "order",
                "dc": "#FFA657",
                "lc": "#953800",
                "e": " Order",
                "em": "adj"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "error",
                "em": "mark"
              },
              {
                "t": "{",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 6,
            "segs": [
              {
                "t": "\terr ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "validate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(order)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 7,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "e": "if err != nil {",
                "em": "repl"
              },
              {
                "t": " err: ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": "if err != nil {",
                "em": "repl"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "e": "if err != nil {",
                "em": "repl"
              }
            ]
          },
          {
            "k": "fold",
            "count": 2,
            "summary": "2 行类型/格式性变更已折叠",
            "olds": [],
            "news": [
              {
                "ln": 8,
                "segs": [
                  {
                    "t": "\t\t",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": "return",
                    "dc": "#FF7B72",
                    "lc": "#CF222E"
                  },
                  {
                    "t": " err",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              },
              {
                "ln": 9,
                "segs": [
                  {
                    "t": "\t}",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 10,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " client.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Connect",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(); err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "!=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "nil",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 7,
            "n": 11,
            "segs": [
              {
                "t": "\t\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " fmt.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Errorf",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"connect: ",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "%w",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": ", err)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 8,
            "n": 12,
            "segs": [
              {
                "t": "\t}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ],
        "raw": [
          {
            "k": "ctx",
            "o": 3,
            "n": 3,
            "segs": [
              {
                "t": "import",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "fmt",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 4,
            "segs": []
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 5,
            "segs": [
              {
                "t": "func",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "SendOrderConfirmation",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "client",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Client",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "order",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Order",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "error",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 6,
            "segs": [
              {
                "t": "\terr ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "validate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(order)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 7,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "!=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "nil",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 8,
            "segs": [
              {
                "t": "\t\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 9,
            "segs": [
              {
                "t": "\t}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 10,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " client.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Connect",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(); err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "!=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "nil",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 7,
            "n": 11,
            "segs": [
              {
                "t": "\t\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " fmt.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Errorf",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"connect: ",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "%w",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": ", err)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 8,
            "n": 12,
            "segs": [
              {
                "t": "\t}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ]
      },
      {
        "path": "src/gift.ts",
        "additions": 3,
        "deletions": 0,
        "badges": [
          {
            "kind": "added",
            "label": "新增",
            "count": 1
          }
        ],
        "units": [
          {
            "name": "giftWrapFee",
            "glyph": "ƒ",
            "tag": "新增",
            "tagKind": "added",
            "membersAdded": [],
            "membersRemoved": []
          }
        ],
        "simplified": [
          {
            "k": "add",
            "n": 1,
            "segs": [
              {
                "t": "export",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "function",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "giftWrapFee",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#FFA657",
                "lc": "#953800",
                "e": ": { wrapped?: boolean }[]",
                "em": "adj"
              },
              {
                "t": ")",
                "dc": "#FFA657",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": ": number",
                "em": "mark"
              },
              {
                "t": " {",
                "dc": "#FFA657",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 2,
            "segs": [
              {
                "t": "  ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FFA657",
                "lc": "#CF222E"
              },
              {
                "t": " items.filter((",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "it",
                "dc": "#FFA657",
                "lc": "#8250DF"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "it",
                "dc": "#FFA657",
                "lc": "#CF222E"
              },
              {
                "t": ".",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "wrapped",
                "dc": "#FFA657",
                "lc": "#0550AE"
              },
              {
                "t": ").",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "length",
                "dc": "#D2A8FF",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#0550AE"
              },
              {
                "t": " 3;",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 3,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ],
        "raw": [
          {
            "k": "add",
            "n": 1,
            "segs": [
              {
                "t": "export",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "function",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "giftWrapFee",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " { ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "wrapped",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "?:",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "boolean",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " }[])",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "number",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 2,
            "segs": [
              {
                "t": "  ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "filter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "((",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "it",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it.wrapped).",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "length",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "3",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ";",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 3,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ]
      }
    ]
  },
  "en": {
    "featured": "src/pricing.rs",
    "files": [
      {
        "path": "src/pricing.rs",
        "additions": 7,
        "deletions": 7,
        "badges": [
          {
            "kind": "signature",
            "label": "Signature",
            "count": 1
          },
          {
            "kind": "type-only",
            "label": "Type",
            "count": 1
          }
        ],
        "units": [
          {
            "name": "total",
            "glyph": "ƒ",
            "tag": "Signature",
            "tagKind": "signature",
            "membersAdded": [],
            "membersRemoved": []
          },
          {
            "name": "LineItem",
            "glyph": "T",
            "tag": "Shape",
            "tagKind": "shape",
            "membersAdded": [
              "note"
            ],
            "membersRemoved": []
          }
        ],
        "simplified": [
          {
            "k": "ctx",
            "o": 1,
            "n": 1,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "struct",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 2,
            "n": 2,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "sku",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": String",
                "em": "adj"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "fold",
            "count": 1,
            "summary": "LineItem: price (type/format changes)",
            "olds": [
              {
                "ln": 3,
                "segs": [
                  {
                    "t": "    price",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": ":",
                    "dc": "#FF7B72",
                    "lc": "#CF222E"
                  },
                  {
                    "t": " ",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": "f64",
                    "dc": "#FFA657",
                    "lc": "#953800"
                  },
                  {
                    "t": ",",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              }
            ],
            "news": [
              {
                "ln": 3,
                "segs": [
                  {
                    "t": "    price",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": ":",
                    "dc": "#FF7B72",
                    "lc": "#CF222E"
                  },
                  {
                    "t": " ",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": "Decimal",
                    "dc": "#FFA657",
                    "lc": "#953800"
                  },
                  {
                    "t": ",",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              }
            ]
          },
          {
            "k": "add",
            "n": 4,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "note",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": Option<String>",
                "em": "adj"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 5,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": u32",
                "em": "adj"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 6,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 7,
            "segs": []
          },
          {
            "k": "del",
            "o": 7,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": &[LineItem]",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": Option<&Coupon>",
                "em": "adj"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "-> f64",
                "em": "mark"
              },
              {
                "t": "{",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 8,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "subtotal",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": f64",
                "em": "adj"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "d"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "sum",
                "dc": "#D2A8FF",
                "lc": "#8250DF",
                "hl": "d"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "match",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 10,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Some",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "d"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "c) ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "c",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": "percent ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "d"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "d"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "d"
              }
            ]
          },
          {
            "k": "del",
            "o": 11,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "None",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal,",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 12,
            "segs": [
              {
                "t": "    }",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 8,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": &[LineItem]",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ": Option<&Coupon>",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "currency",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a",
                "e": ": &Currency",
                "em": "adj"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "-> Result<Decimal, PricingError>",
                "em": "mark"
              },
              {
                "t": "{",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": ".into()",
                "em": "adj"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "fold",
                "dc": "#D2A8FF",
                "lc": "#8250DF",
                "hl": "a"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "a"
              },
              {
                "t": "::",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": "ZERO",
                "dc": "#79C0FF",
                "lc": "#0550AE",
                "hl": "a"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": "acc, x",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": " acc ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": "+",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": " x",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": ");",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 10,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " discount ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "percent)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "unwrap_or_default",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 11,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " rate ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "exchange_rate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(currency)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "?",
                "em": "mark"
              },
              {
                "t": ";",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 12,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Ok",
                "dc": "#FFA657",
                "lc": "#953800",
                "hl": "a"
              },
              {
                "t": "(subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "discount",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "hl": "a"
              },
              {
                "t": " rate)",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "hl": "a"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 13,
            "n": 13,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ],
        "raw": [
          {
            "k": "ctx",
            "o": 1,
            "n": 1,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "struct",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 2,
            "n": 2,
            "segs": [
              {
                "t": "    sku",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "String",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 3,
            "segs": [
              {
                "t": "    price",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 3,
            "segs": [
              {
                "t": "    price",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 4,
            "segs": [
              {
                "t": "    note",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Option",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "String",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ">,",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 5,
            "segs": [
              {
                "t": "    qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "u32",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ",",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 6,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 7,
            "segs": []
          },
          {
            "k": "del",
            "o": 7,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "[",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "], coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Option",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Coupon",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ">) ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "->",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 8,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ")",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "sum",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "match",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 10,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Some",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "(c) ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "percent ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "as",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "f64",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": "),",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 11,
            "segs": [
              {
                "t": "        ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "None",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal,",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "del",
            "o": 12,
            "segs": [
              {
                "t": "    }",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 8,
            "segs": [
              {
                "t": "pub",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "fn",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "total",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "[",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "LineItem",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "], coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Option",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Coupon",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ">, currency",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "&",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Currency",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "->",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Result",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "<",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "PricingError",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "> {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 9,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "iter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "()",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "price ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "qty",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "into",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "())",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "fold",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Decimal",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "::",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "ZERO",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "acc, x",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " acc ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "+",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " x);",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 10,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " discount ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " coupon",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "map",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "|",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " c",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "percent)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ".",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "unwrap_or_default",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "();",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 11,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "let",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " rate ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "exchange_rate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(currency)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "?",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": ";",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 12,
            "segs": [
              {
                "t": "    ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Ok",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "(subtotal ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " (",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "1.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "-",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " discount ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "/",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "100.0",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " rate)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 13,
            "n": 13,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ]
      },
      {
        "path": "src/notify.go",
        "additions": 4,
        "deletions": 0,
        "badges": [
          {
            "kind": "body",
            "label": "Body",
            "count": 1
          }
        ],
        "units": [
          {
            "name": "SendOrderConfirmation",
            "glyph": "ƒ",
            "tag": "Body",
            "tagKind": "body",
            "membersAdded": [],
            "membersRemoved": []
          }
        ],
        "simplified": [
          {
            "k": "ctx",
            "o": 3,
            "n": 3,
            "segs": [
              {
                "t": "import",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "fmt",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 4,
            "segs": []
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 5,
            "segs": [
              {
                "t": "func",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "SendOrderConfirmation",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "client",
                "dc": "#FFA657",
                "lc": "#953800",
                "e": " *Client",
                "em": "adj"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "order",
                "dc": "#FFA657",
                "lc": "#953800",
                "e": " Order",
                "em": "adj"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": "error",
                "em": "mark"
              },
              {
                "t": "{",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 6,
            "segs": [
              {
                "t": "\terr ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "validate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(order)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 7,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "e": "if err != nil {",
                "em": "repl"
              },
              {
                "t": " err: ",
                "dc": "#E6EDF3",
                "lc": "#1F2328",
                "e": "if err != nil {",
                "em": "repl"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E",
                "e": "if err != nil {",
                "em": "repl"
              }
            ]
          },
          {
            "k": "fold",
            "count": 2,
            "summary": "2 type/format-only lines collapsed",
            "olds": [],
            "news": [
              {
                "ln": 8,
                "segs": [
                  {
                    "t": "\t\t",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  },
                  {
                    "t": "return",
                    "dc": "#FF7B72",
                    "lc": "#CF222E"
                  },
                  {
                    "t": " err",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              },
              {
                "ln": 9,
                "segs": [
                  {
                    "t": "\t}",
                    "dc": "#E6EDF3",
                    "lc": "#1F2328"
                  }
                ]
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 10,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " client.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Connect",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(); err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "!=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "nil",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 7,
            "n": 11,
            "segs": [
              {
                "t": "\t\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " fmt.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Errorf",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"connect: ",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "%w",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": ", err)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 8,
            "n": 12,
            "segs": [
              {
                "t": "\t}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ],
        "raw": [
          {
            "k": "ctx",
            "o": 3,
            "n": 3,
            "segs": [
              {
                "t": "import",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "fmt",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 4,
            "n": 4,
            "segs": []
          },
          {
            "k": "ctx",
            "o": 5,
            "n": 5,
            "segs": [
              {
                "t": "func",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "SendOrderConfirmation",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "client",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "Client",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ", ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "order",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Order",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "error",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 6,
            "segs": [
              {
                "t": "\terr ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "validate",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(order)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 7,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "!=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "nil",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 8,
            "segs": [
              {
                "t": "\t\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 9,
            "segs": [
              {
                "t": "\t}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 6,
            "n": 10,
            "segs": [
              {
                "t": "\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "if",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " client.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Connect",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(); err ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "!=",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "nil",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 7,
            "n": 11,
            "segs": [
              {
                "t": "\t\t",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " fmt.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "Errorf",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "\"connect: ",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": "%w",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": "\"",
                "dc": "#A5D6FF",
                "lc": "#0A3069"
              },
              {
                "t": ", err)",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "ctx",
            "o": 8,
            "n": 12,
            "segs": [
              {
                "t": "\t}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ]
      },
      {
        "path": "src/gift.ts",
        "additions": 3,
        "deletions": 0,
        "badges": [
          {
            "kind": "added",
            "label": "Added",
            "count": 1
          }
        ],
        "units": [
          {
            "name": "giftWrapFee",
            "glyph": "ƒ",
            "tag": "Added",
            "tagKind": "added",
            "membersAdded": [],
            "membersRemoved": []
          }
        ],
        "simplified": [
          {
            "k": "add",
            "n": 1,
            "segs": [
              {
                "t": "export",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "function",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "giftWrapFee",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#FFA657",
                "lc": "#953800",
                "e": ": { wrapped?: boolean }[]",
                "em": "adj"
              },
              {
                "t": ")",
                "dc": "#FFA657",
                "lc": "#1F2328"
              },
              {
                "t": "",
                "e": ": number",
                "em": "mark"
              },
              {
                "t": " {",
                "dc": "#FFA657",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 2,
            "segs": [
              {
                "t": "  ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FFA657",
                "lc": "#CF222E"
              },
              {
                "t": " items.filter((",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "it",
                "dc": "#FFA657",
                "lc": "#8250DF"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#953800"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "it",
                "dc": "#FFA657",
                "lc": "#CF222E"
              },
              {
                "t": ".",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "wrapped",
                "dc": "#FFA657",
                "lc": "#0550AE"
              },
              {
                "t": ").",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "length",
                "dc": "#D2A8FF",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#0550AE"
              },
              {
                "t": " 3;",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 3,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ],
        "raw": [
          {
            "k": "add",
            "n": 1,
            "segs": [
              {
                "t": "export",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "function",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "giftWrapFee",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "(",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "items",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " { ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "wrapped",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": "?:",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "boolean",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " }[])",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": ":",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "number",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " {",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 2,
            "segs": [
              {
                "t": "  ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "return",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " items.",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "filter",
                "dc": "#D2A8FF",
                "lc": "#8250DF"
              },
              {
                "t": "((",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "it",
                "dc": "#FFA657",
                "lc": "#953800"
              },
              {
                "t": ") ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "=>",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " it.wrapped).",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "length",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "*",
                "dc": "#FF7B72",
                "lc": "#CF222E"
              },
              {
                "t": " ",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              },
              {
                "t": "3",
                "dc": "#79C0FF",
                "lc": "#0550AE"
              },
              {
                "t": ";",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          },
          {
            "k": "add",
            "n": 3,
            "segs": [
              {
                "t": "}",
                "dc": "#E6EDF3",
                "lc": "#1F2328"
              }
            ]
          }
        ]
      }
    ]
  }
};
