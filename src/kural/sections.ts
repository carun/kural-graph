// What the details panel lists for an idea, with the headings the Kural's own site used. His sections read "Verses that
// heal it" and "Remedied by", and his relation names can't tell a couplet that commends an idea from one that warns
// against it. A sensitive couplet stays off every list here, as it did on a feeling's own page. Read keeps them all.
import type { Neighbor } from "@/lib/graph/graphStore";
import type { RelationType } from "@/lib/types";
import { isSensitive } from "./walk";
import { fromOf } from "./wording";

export function ideaSections(all: Neighbor[]): [string, Neighbor[]][] {
  const safe = all.filter((x) => !isSensitive(x.node));
  const of = (types: RelationType[], outgoing?: boolean, from?: string[]) => {
    const seen = new Set<string>();
    return safe.filter((x) => types.includes(x.type) && (outgoing === undefined || x.outgoing === outgoing) && (!from || from.includes(fromOf(x.props) ?? "")) && !seen.has(x.id) && !!seen.add(x.id));
  };
  return [
    ["What to do with it", of(["HEALS"], false)],
    ["Answered by", of(["ANTIDOTE_TO"], false, ["ANTIDOTE_TO"])],
    ["Answers", of(["ANTIDOTE_TO"], true, ["ANTIDOTE_TO"])],
    ["Overcome by", of(["ANTIDOTE_TO"], false, ["OVERCOMES"])],
    ["Overcomes", of(["ANTIDOTE_TO"], true, ["OVERCOMES"])],
    ["Brought on by", of(["CAUSES_STATE"], false)],
    ["Leads to", of(["CAUSES_STATE"], true)],
    ["Needs", of(["REQUIRES"], true)],
    ["Needed by", of(["REQUIRES"], false)],
    ["Set against", of(["OPPOSES"])],
    ["Defined in", of(["DEFINES_CONCEPT"], false)],
    ["Comes up in", of(["EVOKES_STATE"], false)],
    ["Offered for", of(["RESOLVED_THROUGH"], false)],
    ["Commended in", of(["CULTIVATES", "MENTIONS_CONCEPT"], false, ["COMMENDS"])],
    ["Warned against in", of(["DEPICTS_STATE", "MENTIONS_CONCEPT"], false, ["CONDEMNS"])],
    ["Portrayed in", of(["DEPICTS_STATE"], false, ["PORTRAYS", "VOICES"])],
    ["Spoken of in", of(["MENTIONS_CONCEPT"], false, ["ADDRESSES"])],
    ["Listed in", of(["MENTIONS_STATE", "MENTIONS_CONCEPT"], false, ["ENUMERATES"])],
    ["An image in", of(["MENTIONS_CONCEPT"], false, ["USES_IMAGE"])],
  ];
}
