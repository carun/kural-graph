// Crisis detection, ported from the Kural site's reflect.test.ts. Every phrase here was once a real miss or a real false alarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { concernAcross, concernIn, SUPPORT } from "../src/kural/concern.ts";

const SELF_HARM = [
  // reflect.test.ts: the phrases the first version missed
  "I wish I had never been born",
  "I wish I wasn’t born",
  "I do not want to exist anymore",
  "I don’t want to live",
  "I want to disappear",
  "I want it all to stop",
  "what is the point of living",
  "what’s the point of anything",
  "they would be better off without me",
  "no one would miss me",
  "I can’t take this anymore",
  "I am tired of living",
  // reflect.test.ts: plain statements
  "I want to kill myself",
  "I don't want to live anymore",
  "thinking about suicide",
  "I keep hurting myself",
  "there is no reason to go on",
  "i can't go on",
  "better to die than live like this",
  "I'd rather die than face them",
  "life is not worth living",
  "I would be better off dead",
  "there is nothing to live for",
  "I want to end it all",
  // the rest of the phrases in the pattern, each on its own
  "I am ending my life tonight",
  "I want to end everything",
  "I will take my own life",
  "I wanted to die",
  "I wish I was dead",
  "I wish I were dead",
  "I wish I could be dead",
  "I wish I could die",
  "I wish to die",
  "I wished I had not been born",
  "they’d be better off if I’m gone",
  "better off if i was dead",
  "might as well die",
  "might as well be dead",
  "I don’t want to be here",
  "I don’t want to be alive",
  "I do not want to wake up",
  "I don't want to go on",
  "I want to stop existing",
  "I want to not exist",
  "I wanted to be gone",
  "I want this to stop",
  "I want everything to end",
  "I want all of this to be over",
  "no point living",
  "no point in going on",
  "what is the point of life",
  "what's the point in going on",
  "what is the point of being alive",
  "nobody would notice",
  "no one would care",
  "tired of life",
  "tired of being alive",
  "I can't do this anymore",
  "I can’t do it any more",
  "self harm",
  "self-harm",
  "cutting myself",
  "I cut myself",
  "no reason to live",
  "I want to disappear forever",
  // his net, kept: a run-together spelling, a longer word, Hindi, and the Tamil word
  "I will kill my self",
  "selfharming",
  "आत्महत्या",
  "मरना चाहता हूँ",
  "मरना चाहती हूँ",
  "தற்கொலை",
];

for (const text of SELF_HARM) test(`shows support first for “${text}”`, () => assert.equal(concernIn(text), "self-harm"));

const ABUSE = [
  "my husband hits me",
  "she beats me when she drinks",
  "I am afraid to go home",
  "my partner threatens me every night",
  "it was domestic violence",
  "my boyfriend chokes me",
  "my wife slaps me",
  "my father really hurts us",
  "they hit me",
  "my boss threatens my family",
  "he was abusive",
  "afraid of him",
  "scared of my father",
  "she raped me",
  "I was sexually assaulted",
  "I am being stalked",
  "I am not safe at home",
];

for (const text of ABUSE) test(`treats “${text}” as abuse`, () => assert.equal(concernIn(text), "abuse"));

const CALM = [
  "my friend let me down",
  "I do not want to go to work",
  "what is the point of this meeting",
  "I wish I had not said that",
  "my boss takes credit for my work",
  "I am tired of arguing",
  "a friend let me down",
  "dying to know how this ends",
];

for (const text of CALM) test(`leaves “${text}” alone`, () => assert.equal(concernIn(text), null));

test("self-harm outranks abuse in the same words", () => {
  assert.equal(concernIn("my husband hits me and I want to die"), "self-harm");
});

test("a curly apostrophe changes nothing", () => {
  for (const [curly, straight] of [["don’t want to live", "don't want to live"], ["can’t go on", "can't go on"], ["what’s the point of life", "what's the point of life"], ["don‘t want to live", "don't want to live"]]) {
    assert.equal(concernIn(curly), concernIn(straight));
    assert.equal(concernIn(curly), "self-harm");
  }
});

test("what is on screen counts as much as what is being typed", () => {
  assert.equal(concernAcross("a calm note", "I want to die"), "self-harm");
  assert.equal(concernAcross("my husband hits me", "I want to die"), "self-harm");
  assert.equal(concernAcross("my husband hits me", undefined), "abuse");
  assert.equal(concernAcross("a calm note", undefined), null);
});

test("the helplines stay: Tele-MANAS, the others, and a line for anywhere", () => {
  const selfHarm = SUPPORT["self-harm"].lines.map((l) => `${l.label} ${l.contact}`).join("\n");
  assert.match(selfHarm, /Tele-MANAS/);
  assert.match(selfHarm, /14416/);
  assert.match(selfHarm, /988/);
  assert.match(selfHarm, /116 123/);
  assert.match(selfHarm, /findahelpline\.com/);
  assert.match(selfHarm, /emergency number/);
  const abuse = SUPPORT.abuse.lines.map((l) => `${l.label} ${l.contact}`).join("\n");
  assert.match(abuse, /181/);
  assert.match(abuse, /1-800-799-7233/);
  assert.match(abuse, /findahelpline\.com/);
  assert.match(abuse, /emergency number/);
});
