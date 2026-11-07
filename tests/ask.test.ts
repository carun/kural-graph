// Ask: question intent (no feelings assigned to study questions), follow-ups, and table recognition.
import { test } from "node:test";
import assert from "node:assert/strict";
import { askIntent, intentNote, isFollowUp } from "../src/lib/graphrag/intent.ts";
import { readTable } from "../src/components/chat/markdownTable.ts";

test("the audited beginner question is a study question, not a disclosure", () => {
  assert.equal(askIntent("Explain Kural 380 in simple words for someone new to the Kural. How can effort matter if fate gets there first?"), "study");
  assert.equal(askIntent("Can you give me a practical example of that distinction?"), "general");
  assert.match(intentNote("study"), /Do not describe or guess the asker's feelings/);
  assert.match(intentNote("general"), /unless they stated them/);
});

test("a stated feeling makes it personal; a literary question about grief does not", () => {
  assert.equal(askIntent("I feel worried about tomorrow."), "personal");
  assert.equal(askIntent("I'm so anxious about my exam results and can't sleep."), "personal");
  assert.equal(askIntent("I lost my father last month. How do I carry this grief?"), "personal");
  assert.equal(askIntent("What does the Kural say about grief?"), "study");
  assert.equal(askIntent("Why does he grieve in chapter 118?"), "study");
});

test("short or referential questions are follow-ups", () => {
  assert.equal(isFollowUp("Why?"), true);
  assert.equal(isFollowUp("What about that?"), true);
  assert.equal(isFollowUp("Compare the three aims of life as described across the chapters on wealth and on desire"), false);
});

test("markdown tables are recognised and every cell keeps its column label", () => {
  const lines = ["Intro", "| Focus | Effort | Result |", "|---|:---:|---|", "| Exam | Study well | Grade |", "| Work | Do the task | Praise | extra |", "", "After"];
  const t = readTable(lines, 1)!;
  assert.deepEqual(t.header, ["Focus", "Effort", "Result"]);
  assert.deepEqual(t.rows, [
    ["Exam", "Study well", "Grade"],
    ["Work", "Do the task", "Praise"],
  ]);
  assert.equal(t.next, 5);
  assert.equal(readTable(lines, 0), null);
  assert.equal(readTable(["a | b | c", "not a separator"], 0), null, "pipes in prose without a separator stay prose");
});
