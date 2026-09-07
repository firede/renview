export interface PullRequestAddress {
  owner: string;
  repo: string;
  number: number;
}

/** 只解析 github.com 的 PR 地址，后端绝不请求用户提供的任意 URL。 */
export function parsePullRequest(input: string): PullRequestAddress {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("请输入有效的 GitHub PR 地址");
  }
  const match = /^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)(?:\/.*)?$/.exec(
    url.pathname,
  );
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    !match ||
    match[2] === "." ||
    match[2] === ".." ||
    !Number.isSafeInteger(Number(match[3]))
  ) {
    throw new Error("请输入有效的 GitHub PR 地址");
  }
  return { owner: match[1].toLowerCase(), repo: match[2].toLowerCase(), number: Number(match[3]) };
}
export function pullRequestUrl(pr: PullRequestAddress) {
  return `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}`;
}

/** 在线阅读地址与 GitHub PR 地址一一对应。 */
export function pullRequestPath(pr: PullRequestAddress) {
  return `/gh/${pr.owner}/${pr.repo}/pull/${pr.number}`;
}
