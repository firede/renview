import type { LanguageProfile } from "./types";
import { typescriptProfile, tsxProfile } from "./typescript";

const byExtension = new Map<string, LanguageProfile>();
for (const profile of [typescriptProfile, tsxProfile]) {
  for (const ext of profile.extensions) byExtension.set(ext, profile);
}

export function profileForPath(path: string): LanguageProfile | null {
  const m = /\.([^.]+)$/.exec(path);
  return m ? (byExtension.get(m[1]!.toLowerCase()) ?? null) : null;
}
