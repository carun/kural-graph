// When someone's words suggest they may be in danger, a person comes before any couplet. Ported whole from the Kural's
// own site, where each phrase was added after a real miss. No imports, so it runs under `node --test`.

export type Concern = "self-harm" | "abuse" | null;

const SELF_HARM = /\b(kill(ing)? myself|suicid\w*|end(ing)? my life|end(ing)? (it all|everything)|take my (own )?life|want(ed)? to die|wish(ing)? (i (was|were|could be) dead|i could die|to die)|wish(ed|ing)?\b[^.!?]{0,24}\b(never|not|\w+n't) (been )?born|better (off )?(to die|dead)|better off (without me|if i('m| was| were) (gone|dead))|rather (die|be dead)|might as well (die|be dead)|(don'?t|do not) want to (live|be here|be alive|exist|wake up|go on)|want(ed)? to (disappear|stop existing|not exist|be gone)|want (it|this|everything|all of this)( all)? to (stop|end|be over)|not worth living|no point (in )?(living|going on)|(what'?s|what is) the point (of|in) (living|life|going on|being alive|anything)|(no one|nobody) would (miss|notice|care)|tired of (living|life|being alive)|can'?t (take|do) (it|this) any ?more|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|no reason to (live|go on)|can'?t go on|nothing to live for|disappear forever)\b/i;
const ABUSE = /\b((he|she|they|husband|wife|partner|boyfriend|girlfriend|father|mother|boss) (\w+ )?(hits?|beats?|chokes?|slaps?|rapes?|threatens?|hurts?) (me|us|my)|abus\w*|domestic violence|afraid (of|to go home)|scared of (him|her|them|my)|raped?|sexually assault\w*|being stalked|not safe at home)\b/i;
/** GitaViśva's own net, kept so that nothing it caught is lost: spellings ours misses, and words in Hindi and Tamil. */
const ALSO_SELF_HARM = [/\bkill(ing)? my ?self\b/i, /\bsuicid/i, /\bself[- ]?harm/i, /आत्महत्या/, /मरना चाहता/, /मरना चाहती/, /தற்கொலை/];

/** Support comes before any couplet. Erring towards showing it is the safe direction. */
export function concernIn(text: string): Concern {
  // Phones type a curly apostrophe, and "don’t want to live" must not slip past for that.
  const plain = text.replace(/[’‘]/g, "'");
  if (SELF_HARM.test(plain) || ALSO_SELF_HARM.some((re) => re.test(plain))) return "self-harm";
  if (ABUSE.test(plain)) return "abuse";
  return null;
}

/** The gravest concern across several pieces of writing: what is typed now, and what the results on screen were made for. */
export function concernAcross(...texts: (string | undefined)[]): Concern {
  const found = texts.map((t) => (t ? concernIn(t) : null));
  return found.includes("self-harm") ? "self-harm" : found.includes("abuse") ? "abuse" : null;
}

/** What a model may see of a conversation: a question that raised a self-harm concern stays in this browser, and so does the reply to it. */
export function withoutConcerns<M extends { role: string; content: string }>(messages: M[]): M[] {
  let held = false;
  return messages.filter((m) => {
    if (m.role === "user") held = concernIn(m.content) === "self-harm";
    return !held;
  });
}

export interface Helpline {
  label: string;
  contact: string;
  href?: string;
}

const ANYWHERE: Helpline[] = [
  { label: "Anywhere", contact: "findahelpline.com", href: "https://findahelpline.com" },
  { label: "If you are in immediate danger", contact: "call your local emergency number" },
];

export const SUPPORT: Record<Exclude<Concern, null>, { title: string; text: string; lines: Helpline[] }> = {
  "self-harm": {
    title: "Please talk to someone now",
    text: "What you’ve written matters more than any book. A real person can help you tonight, and you don’t have to explain it perfectly.",
    lines: [
      { label: "India: Tele-MANAS (24×7, free)", contact: "14416 or 1-800-891-4416", href: "tel:14416" },
      { label: "United States: call or text", contact: "988", href: "tel:988" },
      { label: "United Kingdom and Ireland: Samaritans", contact: "116 123", href: "tel:116123" },
      ...ANYWHERE,
    ],
  },
  abuse: {
    title: "You deserve to be safe",
    text: "No couplet should keep you somewhere you are being hurt. These people can help you think about what to do, in confidence.",
    lines: [
      { label: "India: Women Helpline", contact: "181", href: "tel:181" },
      { label: "United States: National Domestic Violence Hotline", contact: "1-800-799-7233", href: "tel:18007997233" },
      ...ANYWHERE,
    ],
  },
};
