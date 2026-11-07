/** Collects every failed invariant in a stage, then fails once with the full list. */
export class Checks {
  private readonly failures: string[] = [];
  private readonly stage: string;

  constructor(stage: string) {
    this.stage = stage;
  }

  that(condition: boolean, message: string): void {
    if (!condition) this.failures.push(message);
  }

  equal<T>(actual: T, expected: T, label: string): void {
    this.that(actual === expected, `${label}: expected ${String(expected)}, got ${String(actual)}`);
  }

  finish(): void {
    if (this.failures.length === 0) {
      console.log(`  ok: ${this.stage}`);
      return;
    }
    const shown = this.failures.slice(0, 40).map((f) => `  - ${f}`).join('\n');
    const more = this.failures.length > 40 ? `\n  ...and ${this.failures.length - 40} more` : '';
    throw new Error(`${this.stage} failed ${this.failures.length} check(s):\n${shown}${more}`);
  }
}
