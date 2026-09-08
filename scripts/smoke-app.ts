/** 用临时 Redis 和虚拟凭据验证实际发布镜像，不向宿主发布端口。 */
const image = process.argv[2];
if (!image) throw new Error("请传入待验证镜像");
const name = `renview-smoke-${process.pid}`;
async function docker(args: string[], allowFailure = false) {
  const child = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "pipe" });
  const [code, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code && !allowFailure) throw new Error(`容器检查失败：${error || output}`);
  return { code, output };
}
async function health(expected: number) {
  for (let i = 0; i < 30; i++) {
    const result = await docker(
      [
        "exec",
        name,
        "bun",
        "-e",
        `const r=await fetch('http://localhost:3000/healthz',{signal:AbortSignal.timeout(5000)});process.exit(r.status===${expected}?0:1)`,
      ],
      true,
    );
    if (!result.code) return;
    await Bun.sleep(500);
  }
  throw new Error(`健康接口未返回 ${expected}`);
}
try {
  await docker(["network", "create", name]);
  await docker([
    "run",
    "-d",
    "--name",
    `${name}-redis`,
    "--network",
    name,
    "redis:7.4-alpine",
    "redis-server",
    "--save",
    "",
    "--appendonly",
    "no",
  ]);
  await docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    name,
    "--platform",
    "linux/amd64",
    "--read-only",
    "--tmpfs",
    "/data:uid=1000,gid=1000",
    "--tmpfs",
    "/tmp",
    "-e",
    "APP_ORIGIN=http://localhost:3000",
    "-e",
    "GITHUB_CLIENT_ID=test",
    "-e",
    "GITHUB_CLIENT_SECRET=test",
    "-e",
    `AUTH_ENCRYPTION_KEY=${"ab".repeat(32)}`,
    "-e",
    `REDIS_URL=redis://${name}-redis:6379`,
    image,
  ]);
  await health(200);
  console.log("健康接口正常");
  await docker([
    "exec",
    name,
    "bun",
    "-e",
    `
    for (const path of ['/', '/gh/a/b/pull/1', '/api/session']) {
      const r = await fetch('http://localhost:3000'+path);
      if (!r.ok) throw new Error('页面或会话接口失败');
    }
    if (await Bun.file('/app/.env').exists()) throw new Error('镜像包含环境文件');
    const worker = new Worker(process.env.ANALYSIS_WORKER_PATH);
    await new Promise((resolve, reject) => {
      const timeout=setTimeout(()=>reject(new Error('worker 超时')),10000);
      worker.onerror=reject;
      worker.onmessage=({data})=>{
        clearTimeout(timeout); worker.terminate();
        if(data.error || data.result?.degradedReason || !data.result?.outline?.length) reject(new Error('worker 分析失败'));
        else resolve(null);
      };
      worker.postMessage({kind:'file',path:'a.ts',source:'export function fee(n: number): number { return n * 2; }',locale:'zh-CN'});
    });
  `,
  ]);
  await docker(["stop", `${name}-redis`]);
  await health(503);
  console.log("Redis 停止时返回不可用");
  await docker(["start", `${name}-redis`]);
  await health(200);
  console.log("健康接口正常");
  console.log("镜像首页、会话、分析 worker 和 Redis 故障恢复检查通过");
} catch (error) {
  console.error((await docker(["logs", name], true)).output);
  throw error;
} finally {
  await docker(["rm", "-f", name, `${name}-redis`], true);
  await docker(["network", "rm", name], true);
}
