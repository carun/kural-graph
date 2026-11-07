// Crisis-language detection. This is a reading companion, not a clinician: when someone signals they may be in danger,
// the UI surfaces human help first, online or offline, with or without a key. The rules live in src/kural/concern.ts.
import { concernIn, SUPPORT } from "@/kural/concern";

export { concernAcross, concernIn, SUPPORT, withoutConcerns, type Concern } from "@/kural/concern";

export function detectCrisis(text: string): boolean {
  return concernIn(text) !== null;
}

export const CRISIS_RESOURCES = SUPPORT["self-harm"].lines;
