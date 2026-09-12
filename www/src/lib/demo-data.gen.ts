// 由 bun run gen:demo 生成；test/samples.test.ts 校验与产品分析结果一致。
import type { DemoChangeset } from "../../../web/src/demo-data";

export const demoData: Record<"zh-CN" | "en", DemoChangeset> = {
  "zh-CN": {
    "diff": {
      "ok": true,
      "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
      "snapshot": "demo",
      "repoRoot": "samples/demo",
      "diffArgs": [],
      "files": [
        {
          "oldPath": "src/pricing.rs",
          "newPath": "src/pricing.rs",
          "status": "modify",
          "projection": {
            "language": "rust",
            "summary": {
              "signature": 1,
              "comment": 0,
              "body": 0,
              "type-only": 1,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/total:7",
                "kind": "function",
                "name": "total",
                "container": "",
                "oldRange": [
                  7,
                  13
                ],
                "newRange": [
                  8,
                  13
                ],
                "change": "signature",
                "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError>",
                "oldSignature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64"
              },
              {
                "id": "/type/LineItem:0",
                "kind": "type",
                "name": "LineItem",
                "container": "",
                "oldRange": [
                  1,
                  5
                ],
                "newRange": [
                  1,
                  6
                ],
                "change": "type-only",
                "typeText": "pub struct LineItem {\n    sku: String,\n    price: Decimal,\n    note: Option<String>,\n    qty: u32,\n}",
                "oldTypeText": "pub struct LineItem {\n    sku: String,\n    price: f64,\n    qty: u32,\n}",
                "domain": {
                  "members": [
                    "sku",
                    "price",
                    "note",
                    "qty"
                  ],
                  "added": [
                    "note"
                  ],
                  "removed": []
                }
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "pub struct LineItem {",
                "oldLn": 1,
                "newLn": 1
              },
              {
                "kind": "ctx",
                "text": "    sku,",
                "oldLn": 2,
                "newLn": 2,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": String"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 1,
                "oldLines": [
                  "    price: f64,"
                ],
                "newLines": [
                  "    price: Decimal,"
                ],
                "oldLns": [
                  3
                ],
                "newLns": [
                  3
                ],
                "summary": "LineItem：price（类型/格式变更）"
              },
              {
                "kind": "add",
                "text": "    note,",
                "newLn": 4,
                "erases": [
                  {
                    "start": 8,
                    "end": 8,
                    "original": ": Option<String>"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "    qty,",
                "oldLn": 4,
                "newLn": 5,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": u32"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 5,
                "newLn": 6
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 6,
                "newLn": 7
              },
              {
                "kind": "del",
                "text": "pub fn total(items, coupon) {",
                "oldLn": 7,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 28,
                    "end": 28,
                    "original": "-> f64"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "del",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
                "oldLn": 8,
                "erases": [
                  {
                    "start": 16,
                    "end": 16,
                    "original": ": f64"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "del",
                "text": "    match coupon {",
                "oldLn": 9
              },
              {
                "kind": "del",
                "text": "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
                "oldLn": 10,
                "pair": 3
              },
              {
                "kind": "del",
                "text": "        None => subtotal,",
                "oldLn": 11
              },
              {
                "kind": "del",
                "text": "    }",
                "oldLn": 12
              },
              {
                "kind": "add",
                "text": "pub fn total(items, coupon, currency) {",
                "newLn": 8,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 36,
                    "end": 36,
                    "original": ": &Currency"
                  },
                  {
                    "start": 38,
                    "end": 38,
                    "original": "-> Result<Decimal, PricingError>"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "add",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
                "newLn": 9,
                "erases": [
                  {
                    "start": 58,
                    "end": 58,
                    "original": ".into()"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "add",
                "text": "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
                "newLn": 10
              },
              {
                "kind": "add",
                "text": "    let rate = exchange_rate(currency);",
                "newLn": 11,
                "erases": [
                  {
                    "start": 38,
                    "end": 38,
                    "original": "?"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
                "newLn": 12,
                "pair": 3
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 13,
                "newLn": 13
              }
            ],
            "stats": {
              "folded": 1,
              "visible": 12
            }
          }
        },
        {
          "oldPath": "src/notify.go",
          "newPath": "src/notify.go",
          "status": "modify",
          "projection": {
            "language": "go",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 1,
              "type-only": 0,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/SendOrderConfirmation:4",
                "kind": "function",
                "name": "SendOrderConfirmation",
                "container": "",
                "oldRange": [
                  5,
                  10
                ],
                "newRange": [
                  5,
                  14
                ],
                "change": "body"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "import \"fmt\"",
                "oldLn": 3,
                "newLn": 3
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 4,
                "newLn": 4
              },
              {
                "kind": "ctx",
                "text": "func SendOrderConfirmation(client, order) {",
                "oldLn": 5,
                "newLn": 5,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": " *Client"
                  },
                  {
                    "start": 40,
                    "end": 40,
                    "original": " Order"
                  },
                  {
                    "start": 42,
                    "end": 42,
                    "original": "error"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "\terr := validate(order)",
                "newLn": 6
              },
              {
                "kind": "add",
                "text": "\tif err: return",
                "newLn": 7,
                "erases": [
                  {
                    "start": 1,
                    "end": 15,
                    "original": "if err != nil {"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 2,
                "oldLines": [],
                "newLines": [
                  "\t\treturn err",
                  "\t}"
                ],
                "oldLns": [],
                "newLns": [
                  8,
                  9
                ]
              },
              {
                "kind": "ctx",
                "text": "\tif err := client.Connect(); err != nil {",
                "oldLn": 6,
                "newLn": 10
              },
              {
                "kind": "ctx",
                "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
                "oldLn": 7,
                "newLn": 11
              },
              {
                "kind": "ctx",
                "text": "\t}",
                "oldLn": 8,
                "newLn": 12
              }
            ],
            "stats": {
              "folded": 2,
              "visible": 2
            }
          }
        },
        {
          "oldPath": null,
          "newPath": "src/gift.ts",
          "status": "add",
          "projection": {
            "language": "typescript",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 0,
              "type-only": 0,
              "added": 1,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/giftWrapFee:0",
                "kind": "function",
                "name": "giftWrapFee",
                "container": "",
                "newRange": [
                  1,
                  3
                ],
                "change": "added",
                "signature": "export function giftWrapFee(items: { wrapped?: boolean }[]): number"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "add",
                "text": "export function giftWrapFee(items) {",
                "newLn": 1,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": ": { wrapped?: boolean }[]"
                  },
                  {
                    "start": 34,
                    "end": 34,
                    "original": ": number"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "  return items.filter((it) => it.wrapped).length * 3;",
                "newLn": 2
              },
              {
                "kind": "add",
                "text": "}",
                "newLn": 3
              }
            ],
            "stats": {
              "folded": 0,
              "visible": 3
            }
          }
        }
      ]
    },
    "reviews": {
      "src/pricing.rs": {
        "ok": true,
        "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
        "snapshot": "demo",
        "entry": {
          "oldPath": "src/pricing.rs",
          "newPath": "src/pricing.rs",
          "status": "modify",
          "projection": {
            "language": "rust",
            "summary": {
              "signature": 1,
              "comment": 0,
              "body": 0,
              "type-only": 1,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/total:7",
                "kind": "function",
                "name": "total",
                "container": "",
                "oldRange": [
                  7,
                  13
                ],
                "newRange": [
                  8,
                  13
                ],
                "change": "signature",
                "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError>",
                "oldSignature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64"
              },
              {
                "id": "/type/LineItem:0",
                "kind": "type",
                "name": "LineItem",
                "container": "",
                "oldRange": [
                  1,
                  5
                ],
                "newRange": [
                  1,
                  6
                ],
                "change": "type-only",
                "typeText": "pub struct LineItem {\n    sku: String,\n    price: Decimal,\n    note: Option<String>,\n    qty: u32,\n}",
                "oldTypeText": "pub struct LineItem {\n    sku: String,\n    price: f64,\n    qty: u32,\n}",
                "domain": {
                  "members": [
                    "sku",
                    "price",
                    "note",
                    "qty"
                  ],
                  "added": [
                    "note"
                  ],
                  "removed": []
                }
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "pub struct LineItem {",
                "oldLn": 1,
                "newLn": 1
              },
              {
                "kind": "ctx",
                "text": "    sku,",
                "oldLn": 2,
                "newLn": 2,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": String"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 1,
                "oldLines": [
                  "    price: f64,"
                ],
                "newLines": [
                  "    price: Decimal,"
                ],
                "oldLns": [
                  3
                ],
                "newLns": [
                  3
                ],
                "summary": "LineItem：price（类型/格式变更）"
              },
              {
                "kind": "add",
                "text": "    note,",
                "newLn": 4,
                "erases": [
                  {
                    "start": 8,
                    "end": 8,
                    "original": ": Option<String>"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "    qty,",
                "oldLn": 4,
                "newLn": 5,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": u32"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 5,
                "newLn": 6
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 6,
                "newLn": 7
              },
              {
                "kind": "del",
                "text": "pub fn total(items, coupon) {",
                "oldLn": 7,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 28,
                    "end": 28,
                    "original": "-> f64"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "del",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
                "oldLn": 8,
                "erases": [
                  {
                    "start": 16,
                    "end": 16,
                    "original": ": f64"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "del",
                "text": "    match coupon {",
                "oldLn": 9
              },
              {
                "kind": "del",
                "text": "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
                "oldLn": 10,
                "pair": 3
              },
              {
                "kind": "del",
                "text": "        None => subtotal,",
                "oldLn": 11
              },
              {
                "kind": "del",
                "text": "    }",
                "oldLn": 12
              },
              {
                "kind": "add",
                "text": "pub fn total(items, coupon, currency) {",
                "newLn": 8,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 36,
                    "end": 36,
                    "original": ": &Currency"
                  },
                  {
                    "start": 38,
                    "end": 38,
                    "original": "-> Result<Decimal, PricingError>"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "add",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
                "newLn": 9,
                "erases": [
                  {
                    "start": 58,
                    "end": 58,
                    "original": ".into()"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "add",
                "text": "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
                "newLn": 10
              },
              {
                "kind": "add",
                "text": "    let rate = exchange_rate(currency);",
                "newLn": 11,
                "erases": [
                  {
                    "start": 38,
                    "end": 38,
                    "original": "?"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
                "newLn": 12,
                "pair": 3
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 13,
                "newLn": 13
              }
            ],
            "stats": {
              "folded": 1,
              "visible": 12
            }
          }
        },
        "oldFile": {
          "path": "src/pricing.rs",
          "language": "rust",
          "source": "pub struct LineItem {\n    sku: String,\n    price: f64,\n    qty: u32,\n}\n\npub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n    match coupon {\n        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n        None => subtotal,\n    }\n}\n",
          "simplified": [
            "pub struct LineItem {",
            "    sku,",
            "    price,",
            "    qty,",
            "}",
            "",
            "pub fn total(items, coupon) {",
            "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
            "    match coupon {",
            "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
            "        None => subtotal,",
            "    }",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "fold",
              "text": "struct LineItem { sku, price, qty }",
              "srcRange": [
                1,
                5
              ],
              "original": [
                "pub struct LineItem {",
                "    sku: String,",
                "    price: f64,",
                "    qty: u32,",
                "}"
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 6
            },
            {
              "kind": "line",
              "text": "pub fn total(items, coupon) {",
              "src": 7,
              "erases": [
                {
                  "start": 18,
                  "end": 18,
                  "original": ": &[LineItem]"
                },
                {
                  "start": 26,
                  "end": 26,
                  "original": ": Option<&Coupon>"
                },
                {
                  "start": 28,
                  "end": 28,
                  "original": "-> f64"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
              "src": 8,
              "erases": [
                {
                  "start": 16,
                  "end": 16,
                  "original": ": f64"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    match coupon {",
              "src": 9
            },
            {
              "kind": "line",
              "text": "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
              "src": 10
            },
            {
              "kind": "line",
              "text": "        None => subtotal,",
              "src": 11
            },
            {
              "kind": "line",
              "text": "    }",
              "src": 12
            },
            {
              "kind": "line",
              "text": "}",
              "src": 13
            }
          ],
          "outline": [
            {
              "kind": "type",
              "name": "LineItem",
              "container": "",
              "typeLevel": true,
              "range": [
                1,
                5
              ]
            },
            {
              "kind": "function",
              "name": "total",
              "container": "",
              "typeLevel": false,
              "range": [
                7,
                13
              ],
              "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64"
            }
          ]
        },
        "newFile": {
          "path": "src/pricing.rs",
          "language": "rust",
          "source": "pub struct LineItem {\n    sku: String,\n    price: Decimal,\n    note: Option<String>,\n    qty: u32,\n}\n\npub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n    let rate = exchange_rate(currency)?;\n    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n}\n",
          "simplified": [
            "pub struct LineItem {",
            "    sku,",
            "    price,",
            "    note,",
            "    qty,",
            "}",
            "",
            "pub fn total(items, coupon, currency) {",
            "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
            "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
            "    let rate = exchange_rate(currency);",
            "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "fold",
              "text": "struct LineItem { sku, price, note, qty }",
              "srcRange": [
                1,
                6
              ],
              "original": [
                "pub struct LineItem {",
                "    sku: String,",
                "    price: Decimal,",
                "    note: Option<String>,",
                "    qty: u32,",
                "}"
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 7
            },
            {
              "kind": "line",
              "text": "pub fn total(items, coupon, currency) {",
              "src": 8,
              "erases": [
                {
                  "start": 18,
                  "end": 18,
                  "original": ": &[LineItem]"
                },
                {
                  "start": 26,
                  "end": 26,
                  "original": ": Option<&Coupon>"
                },
                {
                  "start": 36,
                  "end": 36,
                  "original": ": &Currency"
                },
                {
                  "start": 38,
                  "end": 38,
                  "original": "-> Result<Decimal, PricingError>"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
              "src": 9,
              "erases": [
                {
                  "start": 58,
                  "end": 58,
                  "original": ".into()"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
              "src": 10
            },
            {
              "kind": "line",
              "text": "    let rate = exchange_rate(currency);",
              "src": 11,
              "erases": [
                {
                  "start": 38,
                  "end": 38,
                  "original": "?"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
              "src": 12
            },
            {
              "kind": "line",
              "text": "}",
              "src": 13
            }
          ],
          "outline": [
            {
              "kind": "type",
              "name": "LineItem",
              "container": "",
              "typeLevel": true,
              "range": [
                1,
                6
              ]
            },
            {
              "kind": "function",
              "name": "total",
              "container": "",
              "typeLevel": false,
              "range": [
                8,
                13
              ],
              "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError>"
            }
          ]
        }
      },
      "src/notify.go": {
        "ok": true,
        "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
        "snapshot": "demo",
        "entry": {
          "oldPath": "src/notify.go",
          "newPath": "src/notify.go",
          "status": "modify",
          "projection": {
            "language": "go",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 1,
              "type-only": 0,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/SendOrderConfirmation:4",
                "kind": "function",
                "name": "SendOrderConfirmation",
                "container": "",
                "oldRange": [
                  5,
                  10
                ],
                "newRange": [
                  5,
                  14
                ],
                "change": "body"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "import \"fmt\"",
                "oldLn": 3,
                "newLn": 3
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 4,
                "newLn": 4
              },
              {
                "kind": "ctx",
                "text": "func SendOrderConfirmation(client, order) {",
                "oldLn": 5,
                "newLn": 5,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": " *Client"
                  },
                  {
                    "start": 40,
                    "end": 40,
                    "original": " Order"
                  },
                  {
                    "start": 42,
                    "end": 42,
                    "original": "error"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "\terr := validate(order)",
                "newLn": 6
              },
              {
                "kind": "add",
                "text": "\tif err: return",
                "newLn": 7,
                "erases": [
                  {
                    "start": 1,
                    "end": 15,
                    "original": "if err != nil {"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 2,
                "oldLines": [],
                "newLines": [
                  "\t\treturn err",
                  "\t}"
                ],
                "oldLns": [],
                "newLns": [
                  8,
                  9
                ]
              },
              {
                "kind": "ctx",
                "text": "\tif err := client.Connect(); err != nil {",
                "oldLn": 6,
                "newLn": 10
              },
              {
                "kind": "ctx",
                "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
                "oldLn": 7,
                "newLn": 11
              },
              {
                "kind": "ctx",
                "text": "\t}",
                "oldLn": 8,
                "newLn": 12
              }
            ],
            "stats": {
              "folded": 2,
              "visible": 2
            }
          }
        },
        "oldFile": {
          "path": "src/notify.go",
          "language": "go",
          "source": "package notify\n\nimport \"fmt\"\n\nfunc SendOrderConfirmation(client *Client, order Order) error {\n\tif err := client.Connect(); err != nil {\n\t\treturn fmt.Errorf(\"connect: %w\", err)\n\t}\n\treturn client.Send(order.ReceiptEmail, renderReceipt(order))\n}\n",
          "simplified": [
            "package notify",
            "",
            "import \"fmt\"",
            "",
            "func SendOrderConfirmation(client, order) {",
            "\tif err := client.Connect(); err != nil {",
            "\t\treturn fmt.Errorf(\"connect: %w\", err)",
            "\t}",
            "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "line",
              "text": "package notify",
              "src": 1
            },
            {
              "kind": "line",
              "text": "",
              "src": 2
            },
            {
              "kind": "fold",
              "text": "import × 1（fmt）",
              "srcRange": [
                3,
                3
              ],
              "original": [
                "import \"fmt\""
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 4
            },
            {
              "kind": "line",
              "text": "func SendOrderConfirmation(client, order) {",
              "src": 5,
              "erases": [
                {
                  "start": 33,
                  "end": 33,
                  "original": " *Client"
                },
                {
                  "start": 40,
                  "end": 40,
                  "original": " Order"
                },
                {
                  "start": 42,
                  "end": 42,
                  "original": "error"
                }
              ]
            },
            {
              "kind": "line",
              "text": "\tif err := client.Connect(); err != nil {",
              "src": 6
            },
            {
              "kind": "line",
              "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
              "src": 7
            },
            {
              "kind": "line",
              "text": "\t}",
              "src": 8
            },
            {
              "kind": "line",
              "text": "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
              "src": 9
            },
            {
              "kind": "line",
              "text": "}",
              "src": 10
            }
          ],
          "outline": [
            {
              "kind": "function",
              "name": "SendOrderConfirmation",
              "container": "",
              "typeLevel": false,
              "range": [
                5,
                10
              ],
              "signature": "func SendOrderConfirmation(client *Client, order Order) error"
            }
          ]
        },
        "newFile": {
          "path": "src/notify.go",
          "language": "go",
          "source": "package notify\n\nimport \"fmt\"\n\nfunc SendOrderConfirmation(client *Client, order Order) error {\n\terr := validate(order)\n\tif err != nil {\n\t\treturn err\n\t}\n\tif err := client.Connect(); err != nil {\n\t\treturn fmt.Errorf(\"connect: %w\", err)\n\t}\n\treturn client.Send(order.ReceiptEmail, renderReceipt(order))\n}\n",
          "simplified": [
            "package notify",
            "",
            "import \"fmt\"",
            "",
            "func SendOrderConfirmation(client, order) {",
            "\terr := validate(order)",
            "\tif err: return",
            "",
            "",
            "\tif err := client.Connect(); err != nil {",
            "\t\treturn fmt.Errorf(\"connect: %w\", err)",
            "\t}",
            "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "line",
              "text": "package notify",
              "src": 1
            },
            {
              "kind": "line",
              "text": "",
              "src": 2
            },
            {
              "kind": "fold",
              "text": "import × 1（fmt）",
              "srcRange": [
                3,
                3
              ],
              "original": [
                "import \"fmt\""
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 4
            },
            {
              "kind": "line",
              "text": "func SendOrderConfirmation(client, order) {",
              "src": 5,
              "erases": [
                {
                  "start": 33,
                  "end": 33,
                  "original": " *Client"
                },
                {
                  "start": 40,
                  "end": 40,
                  "original": " Order"
                },
                {
                  "start": 42,
                  "end": 42,
                  "original": "error"
                }
              ]
            },
            {
              "kind": "line",
              "text": "\terr := validate(order)",
              "src": 6
            },
            {
              "kind": "line",
              "text": "\tif err: return",
              "src": 7,
              "erases": [
                {
                  "start": 1,
                  "end": 15,
                  "original": "if err != nil {"
                }
              ]
            },
            {
              "kind": "line",
              "text": "\tif err := client.Connect(); err != nil {",
              "src": 10
            },
            {
              "kind": "line",
              "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
              "src": 11
            },
            {
              "kind": "line",
              "text": "\t}",
              "src": 12
            },
            {
              "kind": "line",
              "text": "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
              "src": 13
            },
            {
              "kind": "line",
              "text": "}",
              "src": 14
            }
          ],
          "outline": [
            {
              "kind": "function",
              "name": "SendOrderConfirmation",
              "container": "",
              "typeLevel": false,
              "range": [
                5,
                14
              ],
              "signature": "func SendOrderConfirmation(client *Client, order Order) error"
            }
          ]
        }
      },
      "src/gift.ts": {
        "ok": true,
        "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
        "snapshot": "demo",
        "entry": {
          "oldPath": null,
          "newPath": "src/gift.ts",
          "status": "add",
          "projection": {
            "language": "typescript",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 0,
              "type-only": 0,
              "added": 1,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/giftWrapFee:0",
                "kind": "function",
                "name": "giftWrapFee",
                "container": "",
                "newRange": [
                  1,
                  3
                ],
                "change": "added",
                "signature": "export function giftWrapFee(items: { wrapped?: boolean }[]): number"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "add",
                "text": "export function giftWrapFee(items) {",
                "newLn": 1,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": ": { wrapped?: boolean }[]"
                  },
                  {
                    "start": 34,
                    "end": 34,
                    "original": ": number"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "  return items.filter((it) => it.wrapped).length * 3;",
                "newLn": 2
              },
              {
                "kind": "add",
                "text": "}",
                "newLn": 3
              }
            ],
            "stats": {
              "folded": 0,
              "visible": 3
            }
          }
        },
        "oldFile": null,
        "newFile": {
          "path": "src/gift.ts",
          "language": "typescript",
          "source": "export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n  return items.filter((it) => it.wrapped).length * 3;\n}\n",
          "simplified": [
            "export function giftWrapFee(items) {",
            "  return items.filter((it) => it.wrapped).length * 3;",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "line",
              "text": "export function giftWrapFee(items) {",
              "src": 1,
              "erases": [
                {
                  "start": 33,
                  "end": 33,
                  "original": ": { wrapped?: boolean }[]"
                },
                {
                  "start": 34,
                  "end": 34,
                  "original": ": number"
                }
              ]
            },
            {
              "kind": "line",
              "text": "  return items.filter((it) => it.wrapped).length * 3;",
              "src": 2
            },
            {
              "kind": "line",
              "text": "}",
              "src": 3
            }
          ],
          "outline": [
            {
              "kind": "function",
              "name": "giftWrapFee",
              "container": "",
              "typeLevel": false,
              "range": [
                1,
                3
              ],
              "signature": "export function giftWrapFee(items: { wrapped?: boolean }[]): number"
            }
          ]
        }
      }
    }
  },
  "en": {
    "diff": {
      "ok": true,
      "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
      "snapshot": "demo",
      "repoRoot": "samples/demo",
      "diffArgs": [],
      "files": [
        {
          "oldPath": "src/pricing.rs",
          "newPath": "src/pricing.rs",
          "status": "modify",
          "projection": {
            "language": "rust",
            "summary": {
              "signature": 1,
              "comment": 0,
              "body": 0,
              "type-only": 1,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/total:7",
                "kind": "function",
                "name": "total",
                "container": "",
                "oldRange": [
                  7,
                  13
                ],
                "newRange": [
                  8,
                  13
                ],
                "change": "signature",
                "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError>",
                "oldSignature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64"
              },
              {
                "id": "/type/LineItem:0",
                "kind": "type",
                "name": "LineItem",
                "container": "",
                "oldRange": [
                  1,
                  5
                ],
                "newRange": [
                  1,
                  6
                ],
                "change": "type-only",
                "typeText": "pub struct LineItem {\n    sku: String,\n    price: Decimal,\n    note: Option<String>,\n    qty: u32,\n}",
                "oldTypeText": "pub struct LineItem {\n    sku: String,\n    price: f64,\n    qty: u32,\n}",
                "domain": {
                  "members": [
                    "sku",
                    "price",
                    "note",
                    "qty"
                  ],
                  "added": [
                    "note"
                  ],
                  "removed": []
                }
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "pub struct LineItem {",
                "oldLn": 1,
                "newLn": 1
              },
              {
                "kind": "ctx",
                "text": "    sku,",
                "oldLn": 2,
                "newLn": 2,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": String"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 1,
                "oldLines": [
                  "    price: f64,"
                ],
                "newLines": [
                  "    price: Decimal,"
                ],
                "oldLns": [
                  3
                ],
                "newLns": [
                  3
                ],
                "summary": "LineItem: price (type/format changes)"
              },
              {
                "kind": "add",
                "text": "    note,",
                "newLn": 4,
                "erases": [
                  {
                    "start": 8,
                    "end": 8,
                    "original": ": Option<String>"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "    qty,",
                "oldLn": 4,
                "newLn": 5,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": u32"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 5,
                "newLn": 6
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 6,
                "newLn": 7
              },
              {
                "kind": "del",
                "text": "pub fn total(items, coupon) {",
                "oldLn": 7,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 28,
                    "end": 28,
                    "original": "-> f64"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "del",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
                "oldLn": 8,
                "erases": [
                  {
                    "start": 16,
                    "end": 16,
                    "original": ": f64"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "del",
                "text": "    match coupon {",
                "oldLn": 9
              },
              {
                "kind": "del",
                "text": "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
                "oldLn": 10,
                "pair": 3
              },
              {
                "kind": "del",
                "text": "        None => subtotal,",
                "oldLn": 11
              },
              {
                "kind": "del",
                "text": "    }",
                "oldLn": 12
              },
              {
                "kind": "add",
                "text": "pub fn total(items, coupon, currency) {",
                "newLn": 8,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 36,
                    "end": 36,
                    "original": ": &Currency"
                  },
                  {
                    "start": 38,
                    "end": 38,
                    "original": "-> Result<Decimal, PricingError>"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "add",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
                "newLn": 9,
                "erases": [
                  {
                    "start": 58,
                    "end": 58,
                    "original": ".into()"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "add",
                "text": "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
                "newLn": 10
              },
              {
                "kind": "add",
                "text": "    let rate = exchange_rate(currency);",
                "newLn": 11,
                "erases": [
                  {
                    "start": 38,
                    "end": 38,
                    "original": "?"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
                "newLn": 12,
                "pair": 3
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 13,
                "newLn": 13
              }
            ],
            "stats": {
              "folded": 1,
              "visible": 12
            }
          }
        },
        {
          "oldPath": "src/notify.go",
          "newPath": "src/notify.go",
          "status": "modify",
          "projection": {
            "language": "go",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 1,
              "type-only": 0,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/SendOrderConfirmation:4",
                "kind": "function",
                "name": "SendOrderConfirmation",
                "container": "",
                "oldRange": [
                  5,
                  10
                ],
                "newRange": [
                  5,
                  14
                ],
                "change": "body"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "import \"fmt\"",
                "oldLn": 3,
                "newLn": 3
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 4,
                "newLn": 4
              },
              {
                "kind": "ctx",
                "text": "func SendOrderConfirmation(client, order) {",
                "oldLn": 5,
                "newLn": 5,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": " *Client"
                  },
                  {
                    "start": 40,
                    "end": 40,
                    "original": " Order"
                  },
                  {
                    "start": 42,
                    "end": 42,
                    "original": "error"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "\terr := validate(order)",
                "newLn": 6
              },
              {
                "kind": "add",
                "text": "\tif err: return",
                "newLn": 7,
                "erases": [
                  {
                    "start": 1,
                    "end": 15,
                    "original": "if err != nil {"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 2,
                "oldLines": [],
                "newLines": [
                  "\t\treturn err",
                  "\t}"
                ],
                "oldLns": [],
                "newLns": [
                  8,
                  9
                ]
              },
              {
                "kind": "ctx",
                "text": "\tif err := client.Connect(); err != nil {",
                "oldLn": 6,
                "newLn": 10
              },
              {
                "kind": "ctx",
                "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
                "oldLn": 7,
                "newLn": 11
              },
              {
                "kind": "ctx",
                "text": "\t}",
                "oldLn": 8,
                "newLn": 12
              }
            ],
            "stats": {
              "folded": 2,
              "visible": 2
            }
          }
        },
        {
          "oldPath": null,
          "newPath": "src/gift.ts",
          "status": "add",
          "projection": {
            "language": "typescript",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 0,
              "type-only": 0,
              "added": 1,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/giftWrapFee:0",
                "kind": "function",
                "name": "giftWrapFee",
                "container": "",
                "newRange": [
                  1,
                  3
                ],
                "change": "added",
                "signature": "export function giftWrapFee(items: { wrapped?: boolean }[]): number"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "add",
                "text": "export function giftWrapFee(items) {",
                "newLn": 1,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": ": { wrapped?: boolean }[]"
                  },
                  {
                    "start": 34,
                    "end": 34,
                    "original": ": number"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "  return items.filter((it) => it.wrapped).length * 3;",
                "newLn": 2
              },
              {
                "kind": "add",
                "text": "}",
                "newLn": 3
              }
            ],
            "stats": {
              "folded": 0,
              "visible": 3
            }
          }
        }
      ]
    },
    "reviews": {
      "src/pricing.rs": {
        "ok": true,
        "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
        "snapshot": "demo",
        "entry": {
          "oldPath": "src/pricing.rs",
          "newPath": "src/pricing.rs",
          "status": "modify",
          "projection": {
            "language": "rust",
            "summary": {
              "signature": 1,
              "comment": 0,
              "body": 0,
              "type-only": 1,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/total:7",
                "kind": "function",
                "name": "total",
                "container": "",
                "oldRange": [
                  7,
                  13
                ],
                "newRange": [
                  8,
                  13
                ],
                "change": "signature",
                "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError>",
                "oldSignature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64"
              },
              {
                "id": "/type/LineItem:0",
                "kind": "type",
                "name": "LineItem",
                "container": "",
                "oldRange": [
                  1,
                  5
                ],
                "newRange": [
                  1,
                  6
                ],
                "change": "type-only",
                "typeText": "pub struct LineItem {\n    sku: String,\n    price: Decimal,\n    note: Option<String>,\n    qty: u32,\n}",
                "oldTypeText": "pub struct LineItem {\n    sku: String,\n    price: f64,\n    qty: u32,\n}",
                "domain": {
                  "members": [
                    "sku",
                    "price",
                    "note",
                    "qty"
                  ],
                  "added": [
                    "note"
                  ],
                  "removed": []
                }
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "pub struct LineItem {",
                "oldLn": 1,
                "newLn": 1
              },
              {
                "kind": "ctx",
                "text": "    sku,",
                "oldLn": 2,
                "newLn": 2,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": String"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 1,
                "oldLines": [
                  "    price: f64,"
                ],
                "newLines": [
                  "    price: Decimal,"
                ],
                "oldLns": [
                  3
                ],
                "newLns": [
                  3
                ],
                "summary": "LineItem: price (type/format changes)"
              },
              {
                "kind": "add",
                "text": "    note,",
                "newLn": 4,
                "erases": [
                  {
                    "start": 8,
                    "end": 8,
                    "original": ": Option<String>"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "    qty,",
                "oldLn": 4,
                "newLn": 5,
                "erases": [
                  {
                    "start": 7,
                    "end": 7,
                    "original": ": u32"
                  }
                ]
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 5,
                "newLn": 6
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 6,
                "newLn": 7
              },
              {
                "kind": "del",
                "text": "pub fn total(items, coupon) {",
                "oldLn": 7,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 28,
                    "end": 28,
                    "original": "-> f64"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "del",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
                "oldLn": 8,
                "erases": [
                  {
                    "start": 16,
                    "end": 16,
                    "original": ": f64"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "del",
                "text": "    match coupon {",
                "oldLn": 9
              },
              {
                "kind": "del",
                "text": "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
                "oldLn": 10,
                "pair": 3
              },
              {
                "kind": "del",
                "text": "        None => subtotal,",
                "oldLn": 11
              },
              {
                "kind": "del",
                "text": "    }",
                "oldLn": 12
              },
              {
                "kind": "add",
                "text": "pub fn total(items, coupon, currency) {",
                "newLn": 8,
                "erases": [
                  {
                    "start": 18,
                    "end": 18,
                    "original": ": &[LineItem]"
                  },
                  {
                    "start": 26,
                    "end": 26,
                    "original": ": Option<&Coupon>"
                  },
                  {
                    "start": 36,
                    "end": 36,
                    "original": ": &Currency"
                  },
                  {
                    "start": 38,
                    "end": 38,
                    "original": "-> Result<Decimal, PricingError>"
                  }
                ],
                "pair": 1
              },
              {
                "kind": "add",
                "text": "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
                "newLn": 9,
                "erases": [
                  {
                    "start": 58,
                    "end": 58,
                    "original": ".into()"
                  }
                ],
                "pair": 2
              },
              {
                "kind": "add",
                "text": "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
                "newLn": 10
              },
              {
                "kind": "add",
                "text": "    let rate = exchange_rate(currency);",
                "newLn": 11,
                "erases": [
                  {
                    "start": 38,
                    "end": 38,
                    "original": "?"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
                "newLn": 12,
                "pair": 3
              },
              {
                "kind": "ctx",
                "text": "}",
                "oldLn": 13,
                "newLn": 13
              }
            ],
            "stats": {
              "folded": 1,
              "visible": 12
            }
          }
        },
        "oldFile": {
          "path": "src/pricing.rs",
          "language": "rust",
          "source": "pub struct LineItem {\n    sku: String,\n    price: f64,\n    qty: u32,\n}\n\npub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n    match coupon {\n        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n        None => subtotal,\n    }\n}\n",
          "simplified": [
            "pub struct LineItem {",
            "    sku,",
            "    price,",
            "    qty,",
            "}",
            "",
            "pub fn total(items, coupon) {",
            "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
            "    match coupon {",
            "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
            "        None => subtotal,",
            "    }",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "fold",
              "text": "struct LineItem { sku, price, qty }",
              "srcRange": [
                1,
                5
              ],
              "original": [
                "pub struct LineItem {",
                "    sku: String,",
                "    price: f64,",
                "    qty: u32,",
                "}"
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 6
            },
            {
              "kind": "line",
              "text": "pub fn total(items, coupon) {",
              "src": 7,
              "erases": [
                {
                  "start": 18,
                  "end": 18,
                  "original": ": &[LineItem]"
                },
                {
                  "start": 26,
                  "end": 26,
                  "original": ": Option<&Coupon>"
                },
                {
                  "start": 28,
                  "end": 28,
                  "original": "-> f64"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    let subtotal = items.iter().map(|it| it.price * it.qty as f64).sum();",
              "src": 8,
              "erases": [
                {
                  "start": 16,
                  "end": 16,
                  "original": ": f64"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    match coupon {",
              "src": 9
            },
            {
              "kind": "line",
              "text": "        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),",
              "src": 10
            },
            {
              "kind": "line",
              "text": "        None => subtotal,",
              "src": 11
            },
            {
              "kind": "line",
              "text": "    }",
              "src": 12
            },
            {
              "kind": "line",
              "text": "}",
              "src": 13
            }
          ],
          "outline": [
            {
              "kind": "type",
              "name": "LineItem",
              "container": "",
              "typeLevel": true,
              "range": [
                1,
                5
              ]
            },
            {
              "kind": "function",
              "name": "total",
              "container": "",
              "typeLevel": false,
              "range": [
                7,
                13
              ],
              "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64"
            }
          ]
        },
        "newFile": {
          "path": "src/pricing.rs",
          "language": "rust",
          "source": "pub struct LineItem {\n    sku: String,\n    price: Decimal,\n    note: Option<String>,\n    qty: u32,\n}\n\npub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n    let rate = exchange_rate(currency)?;\n    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n}\n",
          "simplified": [
            "pub struct LineItem {",
            "    sku,",
            "    price,",
            "    note,",
            "    qty,",
            "}",
            "",
            "pub fn total(items, coupon, currency) {",
            "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
            "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
            "    let rate = exchange_rate(currency);",
            "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "fold",
              "text": "struct LineItem { sku, price, note, qty }",
              "srcRange": [
                1,
                6
              ],
              "original": [
                "pub struct LineItem {",
                "    sku: String,",
                "    price: Decimal,",
                "    note: Option<String>,",
                "    qty: u32,",
                "}"
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 7
            },
            {
              "kind": "line",
              "text": "pub fn total(items, coupon, currency) {",
              "src": 8,
              "erases": [
                {
                  "start": 18,
                  "end": 18,
                  "original": ": &[LineItem]"
                },
                {
                  "start": 26,
                  "end": 26,
                  "original": ": Option<&Coupon>"
                },
                {
                  "start": 36,
                  "end": 36,
                  "original": ": &Currency"
                },
                {
                  "start": 38,
                  "end": 38,
                  "original": "-> Result<Decimal, PricingError>"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    let subtotal = items.iter().map(|it| it.price * it.qty).fold(Decimal::ZERO, |acc, x| acc + x);",
              "src": 9,
              "erases": [
                {
                  "start": 58,
                  "end": 58,
                  "original": ".into()"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    let discount = coupon.map(|c| c.percent).unwrap_or_default();",
              "src": 10
            },
            {
              "kind": "line",
              "text": "    let rate = exchange_rate(currency);",
              "src": 11,
              "erases": [
                {
                  "start": 38,
                  "end": 38,
                  "original": "?"
                }
              ]
            },
            {
              "kind": "line",
              "text": "    Ok(subtotal * (1.0 - discount / 100.0) * rate)",
              "src": 12
            },
            {
              "kind": "line",
              "text": "}",
              "src": 13
            }
          ],
          "outline": [
            {
              "kind": "type",
              "name": "LineItem",
              "container": "",
              "typeLevel": true,
              "range": [
                1,
                6
              ]
            },
            {
              "kind": "function",
              "name": "total",
              "container": "",
              "typeLevel": false,
              "range": [
                8,
                13
              ],
              "signature": "pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError>"
            }
          ]
        }
      },
      "src/notify.go": {
        "ok": true,
        "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
        "snapshot": "demo",
        "entry": {
          "oldPath": "src/notify.go",
          "newPath": "src/notify.go",
          "status": "modify",
          "projection": {
            "language": "go",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 1,
              "type-only": 0,
              "added": 0,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/SendOrderConfirmation:4",
                "kind": "function",
                "name": "SendOrderConfirmation",
                "container": "",
                "oldRange": [
                  5,
                  10
                ],
                "newRange": [
                  5,
                  14
                ],
                "change": "body"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "ctx",
                "text": "import \"fmt\"",
                "oldLn": 3,
                "newLn": 3
              },
              {
                "kind": "ctx",
                "text": "",
                "oldLn": 4,
                "newLn": 4
              },
              {
                "kind": "ctx",
                "text": "func SendOrderConfirmation(client, order) {",
                "oldLn": 5,
                "newLn": 5,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": " *Client"
                  },
                  {
                    "start": 40,
                    "end": 40,
                    "original": " Order"
                  },
                  {
                    "start": 42,
                    "end": 42,
                    "original": "error"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "\terr := validate(order)",
                "newLn": 6
              },
              {
                "kind": "add",
                "text": "\tif err: return",
                "newLn": 7,
                "erases": [
                  {
                    "start": 1,
                    "end": 15,
                    "original": "if err != nil {"
                  }
                ]
              },
              {
                "kind": "fold",
                "count": 2,
                "oldLines": [],
                "newLines": [
                  "\t\treturn err",
                  "\t}"
                ],
                "oldLns": [],
                "newLns": [
                  8,
                  9
                ]
              },
              {
                "kind": "ctx",
                "text": "\tif err := client.Connect(); err != nil {",
                "oldLn": 6,
                "newLn": 10
              },
              {
                "kind": "ctx",
                "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
                "oldLn": 7,
                "newLn": 11
              },
              {
                "kind": "ctx",
                "text": "\t}",
                "oldLn": 8,
                "newLn": 12
              }
            ],
            "stats": {
              "folded": 2,
              "visible": 2
            }
          }
        },
        "oldFile": {
          "path": "src/notify.go",
          "language": "go",
          "source": "package notify\n\nimport \"fmt\"\n\nfunc SendOrderConfirmation(client *Client, order Order) error {\n\tif err := client.Connect(); err != nil {\n\t\treturn fmt.Errorf(\"connect: %w\", err)\n\t}\n\treturn client.Send(order.ReceiptEmail, renderReceipt(order))\n}\n",
          "simplified": [
            "package notify",
            "",
            "import \"fmt\"",
            "",
            "func SendOrderConfirmation(client, order) {",
            "\tif err := client.Connect(); err != nil {",
            "\t\treturn fmt.Errorf(\"connect: %w\", err)",
            "\t}",
            "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "line",
              "text": "package notify",
              "src": 1
            },
            {
              "kind": "line",
              "text": "",
              "src": 2
            },
            {
              "kind": "fold",
              "text": "1 import (fmt)",
              "srcRange": [
                3,
                3
              ],
              "original": [
                "import \"fmt\""
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 4
            },
            {
              "kind": "line",
              "text": "func SendOrderConfirmation(client, order) {",
              "src": 5,
              "erases": [
                {
                  "start": 33,
                  "end": 33,
                  "original": " *Client"
                },
                {
                  "start": 40,
                  "end": 40,
                  "original": " Order"
                },
                {
                  "start": 42,
                  "end": 42,
                  "original": "error"
                }
              ]
            },
            {
              "kind": "line",
              "text": "\tif err := client.Connect(); err != nil {",
              "src": 6
            },
            {
              "kind": "line",
              "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
              "src": 7
            },
            {
              "kind": "line",
              "text": "\t}",
              "src": 8
            },
            {
              "kind": "line",
              "text": "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
              "src": 9
            },
            {
              "kind": "line",
              "text": "}",
              "src": 10
            }
          ],
          "outline": [
            {
              "kind": "function",
              "name": "SendOrderConfirmation",
              "container": "",
              "typeLevel": false,
              "range": [
                5,
                10
              ],
              "signature": "func SendOrderConfirmation(client *Client, order Order) error"
            }
          ]
        },
        "newFile": {
          "path": "src/notify.go",
          "language": "go",
          "source": "package notify\n\nimport \"fmt\"\n\nfunc SendOrderConfirmation(client *Client, order Order) error {\n\terr := validate(order)\n\tif err != nil {\n\t\treturn err\n\t}\n\tif err := client.Connect(); err != nil {\n\t\treturn fmt.Errorf(\"connect: %w\", err)\n\t}\n\treturn client.Send(order.ReceiptEmail, renderReceipt(order))\n}\n",
          "simplified": [
            "package notify",
            "",
            "import \"fmt\"",
            "",
            "func SendOrderConfirmation(client, order) {",
            "\terr := validate(order)",
            "\tif err: return",
            "",
            "",
            "\tif err := client.Connect(); err != nil {",
            "\t\treturn fmt.Errorf(\"connect: %w\", err)",
            "\t}",
            "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "line",
              "text": "package notify",
              "src": 1
            },
            {
              "kind": "line",
              "text": "",
              "src": 2
            },
            {
              "kind": "fold",
              "text": "1 import (fmt)",
              "srcRange": [
                3,
                3
              ],
              "original": [
                "import \"fmt\""
              ]
            },
            {
              "kind": "line",
              "text": "",
              "src": 4
            },
            {
              "kind": "line",
              "text": "func SendOrderConfirmation(client, order) {",
              "src": 5,
              "erases": [
                {
                  "start": 33,
                  "end": 33,
                  "original": " *Client"
                },
                {
                  "start": 40,
                  "end": 40,
                  "original": " Order"
                },
                {
                  "start": 42,
                  "end": 42,
                  "original": "error"
                }
              ]
            },
            {
              "kind": "line",
              "text": "\terr := validate(order)",
              "src": 6
            },
            {
              "kind": "line",
              "text": "\tif err: return",
              "src": 7,
              "erases": [
                {
                  "start": 1,
                  "end": 15,
                  "original": "if err != nil {"
                }
              ]
            },
            {
              "kind": "line",
              "text": "\tif err := client.Connect(); err != nil {",
              "src": 10
            },
            {
              "kind": "line",
              "text": "\t\treturn fmt.Errorf(\"connect: %w\", err)",
              "src": 11
            },
            {
              "kind": "line",
              "text": "\t}",
              "src": 12
            },
            {
              "kind": "line",
              "text": "\treturn client.Send(order.ReceiptEmail, renderReceipt(order))",
              "src": 13
            },
            {
              "kind": "line",
              "text": "}",
              "src": 14
            }
          ],
          "outline": [
            {
              "kind": "function",
              "name": "SendOrderConfirmation",
              "container": "",
              "typeLevel": false,
              "range": [
                5,
                14
              ],
              "signature": "func SendOrderConfirmation(client *Client, order Order) error"
            }
          ]
        }
      },
      "src/gift.ts": {
        "ok": true,
        "diff": "diff --git a/src/pricing.rs b/src/pricing.rs\nindex ebe3d53..8569bad 100644\n--- a/src/pricing.rs\n+++ b/src/pricing.rs\n@@ -1,13 +1,13 @@\n pub struct LineItem {\n     sku: String,\n-    price: f64,\n+    price: Decimal,\n+    note: Option<String>,\n     qty: u32,\n }\n \n-pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {\n-    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();\n-    match coupon {\n-        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),\n-        None => subtotal,\n-    }\n+pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {\n+    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);\n+    let discount = coupon.map(|c| c.percent).unwrap_or_default();\n+    let rate = exchange_rate(currency)?;\n+    Ok(subtotal * (1.0 - discount / 100.0) * rate)\n }\ndiff --git a/src/notify.go b/src/notify.go\nindex 184125d..767cb3e 100644\n--- a/src/notify.go\n+++ b/src/notify.go\n@@ -3,6 +3,10 @@ package notify\n import \"fmt\"\n \n func SendOrderConfirmation(client *Client, order Order) error {\n+\terr := validate(order)\n+\tif err != nil {\n+\t\treturn err\n+\t}\n \tif err := client.Connect(); err != nil {\n \t\treturn fmt.Errorf(\"connect: %w\", err)\n \t}\ndiff --git a/src/gift.ts b/src/gift.ts\nnew file mode 100644\nindex 0000000..b80ae59\n--- /dev/null\n+++ b/src/gift.ts\n@@ -0,0 +1,3 @@\n+export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n+  return items.filter((it) => it.wrapped).length * 3;\n+}\n",
        "snapshot": "demo",
        "entry": {
          "oldPath": null,
          "newPath": "src/gift.ts",
          "status": "add",
          "projection": {
            "language": "typescript",
            "summary": {
              "signature": 0,
              "comment": 0,
              "body": 0,
              "type-only": 0,
              "added": 1,
              "removed": 0
            },
            "units": [
              {
                "id": "/function/giftWrapFee:0",
                "kind": "function",
                "name": "giftWrapFee",
                "container": "",
                "newRange": [
                  1,
                  3
                ],
                "change": "added",
                "signature": "export function giftWrapFee(items: { wrapped?: boolean }[]): number"
              }
            ]
          },
          "simplified": {
            "rows": [
              {
                "kind": "add",
                "text": "export function giftWrapFee(items) {",
                "newLn": 1,
                "erases": [
                  {
                    "start": 33,
                    "end": 33,
                    "original": ": { wrapped?: boolean }[]"
                  },
                  {
                    "start": 34,
                    "end": 34,
                    "original": ": number"
                  }
                ]
              },
              {
                "kind": "add",
                "text": "  return items.filter((it) => it.wrapped).length * 3;",
                "newLn": 2
              },
              {
                "kind": "add",
                "text": "}",
                "newLn": 3
              }
            ],
            "stats": {
              "folded": 0,
              "visible": 3
            }
          }
        },
        "oldFile": null,
        "newFile": {
          "path": "src/gift.ts",
          "language": "typescript",
          "source": "export function giftWrapFee(items: { wrapped?: boolean }[]): number {\n  return items.filter((it) => it.wrapped).length * 3;\n}\n",
          "simplified": [
            "export function giftWrapFee(items) {",
            "  return items.filter((it) => it.wrapped).length * 3;",
            "}",
            ""
          ],
          "view": [
            {
              "kind": "line",
              "text": "export function giftWrapFee(items) {",
              "src": 1,
              "erases": [
                {
                  "start": 33,
                  "end": 33,
                  "original": ": { wrapped?: boolean }[]"
                },
                {
                  "start": 34,
                  "end": 34,
                  "original": ": number"
                }
              ]
            },
            {
              "kind": "line",
              "text": "  return items.filter((it) => it.wrapped).length * 3;",
              "src": 2
            },
            {
              "kind": "line",
              "text": "}",
              "src": 3
            }
          ],
          "outline": [
            {
              "kind": "function",
              "name": "giftWrapFee",
              "container": "",
              "typeLevel": false,
              "range": [
                1,
                3
              ],
              "signature": "export function giftWrapFee(items: { wrapped?: boolean }[]): number"
            }
          ]
        }
      }
    }
  }
};
