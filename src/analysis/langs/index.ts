import type { LanguageProfile } from "./types";
import { gdscriptProfile } from "./gdscript";
import { goProfile } from "./go";
import { pythonProfile } from "./python";
import { rustProfile } from "./rust";
import { typescriptProfile, tsxProfile } from "./typescript";

const byExtension = new Map<string, LanguageProfile>();
for (const profile of [
  typescriptProfile,
  tsxProfile,
  rustProfile,
  goProfile,
  gdscriptProfile,
  pythonProfile,
]) {
  for (const ext of profile.extensions) byExtension.set(ext, profile);
}

export function profileForPath(path: string): LanguageProfile | null {
  const m = /\.([^.]+)$/.exec(path);
  return m ? (byExtension.get(m[1]!.toLowerCase()) ?? null) : null;
}
