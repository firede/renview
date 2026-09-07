import { fileURLToPath } from "node:url";
import { Gate } from "./cache";
import type { AnalysisJob } from "./analysis-worker";
import { HttpError } from "./http";

/** 单独 worker 承担同步 WASM 解析；限制排队量并终止超时分析。 */
export class Analyzer {
  private gate = new Gate(1, 16);
  private worker: Worker | null = null;
  constructor(
    private path = process.env.ANALYSIS_WORKER_PATH ??
      fileURLToPath(new URL("./analysis-worker.ts", import.meta.url)),
  ) {}
  run<T>(job: AnalysisJob): Promise<T> {
    return this.gate.run(
      () =>
        new Promise<T>((resolveJob, reject) => {
          const worker = (this.worker ??= new Worker(this.path));
          const fail = () => {
            clearTimeout(timer);
            worker.terminate();
            this.worker = null;
            reject(new HttpError(503, "分析超时或失败，请稍后重试"));
          };
          const timer = setTimeout(fail, 10_000);
          worker.onerror = fail;
          worker.onmessage = (event: MessageEvent<{ result: T; error?: string }>) => {
            clearTimeout(timer);
            worker.onmessage = null;
            worker.onerror = null;
            if (event.data.error) reject(new HttpError(422, event.data.error));
            else resolveJob(event.data.result);
          };
          worker.postMessage(job);
        }),
    );
  }
  close() {
    this.worker?.terminate();
    this.worker = null;
  }
}
