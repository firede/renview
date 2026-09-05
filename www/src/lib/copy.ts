/** 官网双语文案。两语言按各自原生习惯撰写，不逐字对译。 */

export type Lang = "cn" | "en";

export interface Copy {
  htmlLang: string;
  title: string;
  description: string;
  nav: { demo: string; why: string; usage: string; install: string };
  langSwitch: { label: string; href: string; note: string };
  hero: {
    eyebrow: string;
    h1: string;
    sub: string;
  };
  why: {
    title: string;
    items: [{ h: string; p: string }, { h: string; p: string }, { h: string; p: string }];
  };
  facts: { title: string; items: [string, string] };
  usage: {
    title: string;
    rows: [
      { cmd: string; note: string },
      { cmd: string; note: string },
      { cmd: string; note: string },
      { cmd: string; note: string },
    ];
  };
  install: {
    title: string;
    platforms: string;
    mirror?: string;
  };
  footer: { tagline: string; github: string };
  copy: string;
  copied: string;
}

export const cn: Copy = {
  htmlLang: "zh-CN",
  title: "renview — 把注意力留给抽象",
  description: "agent 时代的代码审阅工具，把 diff 呈现在值得判断的层面。",
  nav: { demo: "演示", why: "不同", usage: "用法", install: "安装" },
  langSwitch: { label: "EN", href: "/en/", note: "English 版本" },
  hero: {
    eyebrow: "agent 时代的代码审阅",
    h1: "把注意力留给抽象。",
    sub: "你审的是实现是否贴合业务建模、是不是你想要的。代码级的对错交给 agent。",
  },
  why: {
    title: "和传统 review 工具的不同",
    items: [
      {
        h: "先看契约，再看实现",
        p: "签名变更的文件自动排最前，参数增减在行内词级高亮。接口判断对了，实现扫一遍就够。",
      },
      {
        h: "擦除只碰语言机制",
        p: "类型标注、判空链、错误包装这类机制淡成标记。业务逻辑一字不动。",
      },
      {
        h: "收起的都拿得回",
        p: "每个折叠都写明藏了什么，点击展开。被擦的片段 hover 还原。按 S 整个回到原始 diff。",
      },
    ],
  },
  facts: {
    title: "还有",
    items: ["审 diff 之外，浏览模式用同样的投影读完整文件", "完全本地运行，代码留在本机"],
  },
  usage: {
    title: "在任意 git 仓库里运行",
    rows: [
      { cmd: "renview", note: "审阅未提交变更（含未跟踪新文件）" },
      { cmd: "renview --staged", note: "审阅已暂存变更" },
      { cmd: "renview main...HEAD", note: "审阅分支区间" },
      { cmd: "renview HEAD~3 -- src/", note: "指定区间与路径" },
    ],
  },
  install: {
    title: "一条命令，装完即用",
    platforms: "macOS · Linux · Windows（Git Bash）",
    mirror: "下载走 npm registry，网络受限可设 RENVIEW_REGISTRY=https://registry.npmmirror.com",
  },
  footer: {
    tagline: "renview — 帮人类读懂 agent 写的代码。",
    github: "GitHub",
  },
  copy: "复制",
  copied: "已复制",
};

export const en: Copy = {
  htmlLang: "en",
  title: "renview — Judge the abstraction",
  description:
    "Code review for agent-driven development. Every diff presented at the layer where your judgment matters.",
  nav: { demo: "Demo", why: "Why", usage: "Usage", install: "Install" },
  langSwitch: { label: "中文", href: "/cn/", note: "中文版" },
  hero: {
    eyebrow: "Built for agent-driven development",
    h1: "Judge the abstraction.",
    sub: "Does the implementation match the business model, and is it what you asked for? That judgment is yours. Code-level correctness belongs to the agent.",
  },
  why: {
    title: "How it differs from classic review tools",
    items: [
      {
        h: "Contracts before implementations",
        p: "Files with signature changes sort to the top. Parameter deltas get word-level highlights. When the interface checks out, the body usually only needs a skim.",
      },
      {
        h: "Erasure only touches ceremony",
        p: "What gets erased is language machinery, like type annotations, optional chaining, and error wrapping. Business logic stays untouched.",
      },
      {
        h: "Folded stays reachable",
        p: "Every fold says what it hides and opens on a click. Erased fragments restore on hover. S returns to the raw diff.",
      },
    ],
  },
  facts: {
    title: "Also",
    items: [
      "Beyond diffs, Browse mode reads whole files through the same projection",
      "Runs entirely on your machine. Code stays local",
    ],
  },
  usage: {
    title: "Run it in any git repo",
    rows: [
      { cmd: "renview", note: "review uncommitted changes (untracked files included)" },
      { cmd: "renview --staged", note: "review staged changes" },
      { cmd: "renview main...HEAD", note: "review a branch range" },
      { cmd: "renview HEAD~3 -- src/", note: "pin a range and paths" },
    ],
  },
  install: {
    title: "One command, ready to review",
    platforms: "macOS · Linux · Windows (Git Bash)",
  },
  footer: {
    tagline: "renview — helping humans read what agents write.",
    github: "GitHub",
  },
  copy: "Copy",
  copied: "Copied",
};

export const INSTALL_CMD = "curl -fsSL https://renview.6636.tech/install | bash";
export const SITE = "https://renview.6636.tech";
