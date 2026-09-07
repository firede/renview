import { analyzeFile, viewerFile } from "../../src/analysis/service";
import type { ParsedFile } from "../../src/analysis/map";
import type { Locale } from "../../src/i18n";

export type AnalysisJob =
  | { kind: "file"; path: string; source: string; locale: Locale }
  | {
      kind: "review";
      file: ParsedFile;
      oldSource: string | null;
      newSource: string | null;
      locale: Locale;
    };

declare const self: Worker;
self.onmessage = async (event: MessageEvent<AnalysisJob>) => {
  try {
    const job = event.data;
    if (job.kind === "file") {
      self.postMessage({ result: await viewerFile(job.path, job.source, job.locale) });
    } else {
      const entry = await analyzeFile(job.file, job.oldSource, job.newSource, job.locale);
      const oldFile =
        job.oldSource === null ? null : await viewerFile(job.file.from!, job.oldSource, job.locale);
      const newFile =
        job.newSource === null ? null : await viewerFile(job.file.to!, job.newSource, job.locale);
      self.postMessage({ result: { entry, oldFile, newFile } });
    }
  } catch {
    self.postMessage({ error: "分析失败，请使用原始 diff" });
  }
};
