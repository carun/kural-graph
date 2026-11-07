// His relations are coarser than ours: "portrays" on his graph can be a couplet that warns against something, and that
// difference is the point. `props.from` keeps our link's name, so a reader sees the words the Kural's own site used.
// No imports, so it runs under `node --test`.

const WORDS: Record<string, [string, string]> = {
  COMMENDS: ["commends", "is commended in"],
  CONDEMNS: ["warns against", "is warned against in"],
  DEFINES: ["defines", "is defined in"],
  VOICES: ["voices", "is voiced in"],
  ENUMERATES: ["lists", "is listed in"],
  ADDRESSES: ["concerns", "is the concern of"],
  GUIDES: ["speaks to", "is spoken to by"],
  USES_IMAGE: ["uses the image of", "is an image in"],
  LEADS_TO: ["leads to", "is brought on by"],
  REQUIRES: ["requires", "is needed by"],
  OVERCOMES: ["overcomes", "is overcome by"],
  OPPOSES: ["is set against", "is set against"],
  ECHOES: ["echoes", "is echoed in"],
  QUALIFIES: ["qualifies", "is qualified by"],
  IN_TENSION_WITH: ["is in tension with", "is in tension with"],
  EVOKES: ["can bring", "can come up in"],
  RESOLVED_THROUGH: ["is met through", "is offered for"],
  ANTIDOTE_TO: ["answers", "is answered by"],
  PORTRAYS: ["portrays", "is portrayed in"],
  ANSWERS: ["answers", "is answered by"],
};

type Props = Record<string, unknown> | undefined;

export const fromOf = (props: Props) => (typeof props?.from === "string" ? props.from : undefined);

/** The phrase for a link read from one end: our site's words where the link has them, otherwise his. */
export function linkWords(props: Props, outgoing: boolean, fallback: string): string {
  const words = WORDS[fromOf(props) ?? ""];
  return words ? words[outgoing ? 0 : 1] : fallback;
}

export const BASIS_NOTE: Record<string, string> = {
  explicit: "Stated in the text.",
  inferred: "Inferred.",
  editorial: "Our suggestion, not the Kural’s words.",
};

/** How firmly a link stands, in the reader's words. Empty for links that carry no claim. */
export const basisNote = (props: Props) => (typeof props?.basis === "string" ? (BASIS_NOTE[props.basis] ?? "") : "");
