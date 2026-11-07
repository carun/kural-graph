/* eslint-disable @next/next/no-html-link-for-pages -- a full page load: offline, client navigation from here lands on /index.txt */
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/sacred/SacredMotifs";
import { IastKey } from "@/kural/reader";

export const metadata: Metadata = {
  title: "About · Kural Graph",
  description: "How the readings and links of Kural Graph were made, what happens to your data, and who to thank.",
};

const REPO = "https://github.com/HimanshuMohanty-Git24/gitaviswa";

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="text-accent-text underline underline-offset-2" href={href}>
      {children}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[16px] font-semibold text-text">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

/** What this site is and how it was made. The disclosures are the owner's words. */
export default function About() {
  const strong = "font-semibold text-text";
  return (
    <div className="h-dvh overflow-y-auto bg-bg text-text">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur">
        <a href="/" className="flex items-center gap-2.5" aria-label="Kural Graph home">
          <BrandMark size={26} />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-text">Kural Graph</span>
          <span lang="ta" className="deva hidden text-[13px] leading-none text-text-3 sm:inline">
            குறள் வரைபடம்
          </span>
        </a>
        <a className="btn btn-ghost btn-sm" href="/">
          <ArrowLeft size={14} />
          Back to the Kural
        </a>
      </header>

      <main className="mx-auto max-w-[680px] px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <h1 className="serif text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] text-text sm:text-[34px]">About Kural Graph</h1>
        <p className="reading mt-3">The Tirukkural of Tiruvalluvar is 1,330 couplets in 133 chapters, on right conduct, wealth and desire. This is a way to read it, and to see how its ideas connect.</p>

        <Section title="How the links were made">
          <p className="reading">
            <strong className={strong}>The links between couplets and ideas were written by an AI (Anthropic’s Claude), not by a scholar.</strong> Every link shows its reason, and the words in the plain reading that support it. Links marked “inferred” are an interpretation, not something the couplet says outright.
          </p>
          <p className="reading">
            A second, different AI model checked them independently, and disagreements were judged again. These links are still in draft and need review, so treat them as a reading of the text and not as authority. The text itself always outranks them: <Link href="/?view=adhyayana">read the couplets</Link>.
          </p>
        </Section>

        <Section title="The texts">
          <p className="reading">
            <strong className={strong}>The readings on this site were written by an AI (Anthropic’s Claude), not by a scholar or translator.</strong> Each couplet has two readings. The plain reading says what the Tamil says, in today’s words, and adds no fate, god or setting of its own. parimēlaḻagar’s reading is his 13th-century Tamil commentary, paraphrased into English. It keeps what he says, including his views on caste, karma and women, which are of their time.
          </p>
          <p className="reading">
            V. V. S. Aiyar’s English translation of 1916 is also offered wherever you choose a reading. It is in his own words, from the <Link href="https://standardebooks.org/ebooks/thiruvalluvar/the-kural/v-v-s-aiyar">Standard Ebooks edition</Link>, which is believed to be in the United States public domain. The readings don’t draw on it, and it uses words of its time, such as “love” where the plain reading says “loving-kindness”.
          </p>
          <p className="reading">
            Two older English translations are offered the same way: G. U. Pope’s rhymed verse of 1886 and W. H. Drew and J. Lazarus’s prose of 1885. Both are in their own words, read from public-domain scans on the Internet Archive (<Link href="https://archive.org/details/tiruvalluvanayan00tiruuoft">Pope</Link>, <Link href="https://archive.org/details/kuraloftiruvallu00tirurich">Drew and Lazarus</Link>), with plain printing errors put right. In the 1885 scan, Kurals 761 to 765 fall on misbound pages and Kural 604 repeats its neighbour’s sentence, so those six come from <Link href="https://archive.org/details/xkae-thirukkural-w.-h.-drew-john-lazarus">a later reprint</Link>.
          </p>
          <p className="reading">
            The paraphrases are not his exact words, so each one opens onto his Tamil, from <Link href="https://ta.wikisource.org/wiki/திருக்குறள்_பரிமேலழகர்_உரை">Tamil Wikisource</Link>. Two key words follow the project’s own reading: <span lang="ta" className="deva">அன்பு</span> is loving-kindness, the mēttā of Buddhism, and <span lang="ta" className="deva">காமம்</span> is desire. parimēlaḻagar himself defines <span lang="ta" className="deva">அன்பு</span> more narrowly, as fondness for your family and those connected to you.
          </p>
          <p className="reading">
            Four more Tamil commentaries sit beside his under Commentaries, each in its author’s own words. maṇakkudavar’s is the oldest that survives, from <Link href="https://www.projectmadurai.org/pm_etexts/utf8/pmuni0650.html">Project Madurai</Link>. He orders the couplets differently, so each comment here is filed under the couplet’s usual number. mu. varaḍarāsaṉār’s <span lang="ta" className="deva">திருக்குறள் தெளிவுரை</span> and mayilai civamuṭṭu’s <span lang="ta" className="deva">திருக்குறள், இனிய எளிய உரை</span> are from Tamil Wikisource (<Link href="https://ta.wikisource.org/wiki/திருக்குறள்_தெளிவுரை,_மு._வரதராசன்">mu. varaḍarāsaṉār</Link>, <Link href="https://ta.wikisource.org/wiki/திருக்குறள்,_இனிய_எளிய_உரை">mayilai civamuṭṭu</Link>). mayilai civamuṭṭu’s book covers Parts 1 and 2 only. ṭēvanēyap pāvāṇar’s <span lang="ta" className="deva">திருக்குறள் தமிழ் மரபுரை</span> of 1967 is from the <Link href="https://archive.org/details/tdl.48404-1-1">Tamil Digital Library</Link>. It argues with parimēlaḻagar openly, and carries his own views of Tamil and Aryan history.
          </p>
          <p className="reading">
            The Tamil starts from the <Link href="https://github.com/tk120404/thirukkural">thirukkural dataset</Link> (Apache 2.0). It was checked line by line against <Link href="https://www.projectmadurai.org/">Project Madurai</Link> and two editions on <Link href="https://ta.wikisource.org/">Tamil Wikisource</Link>, and 105 decisions were reviewed, including 63 repairs of damaged text. <Link href="/NOTICE.txt">Notices and credits</Link>.
          </p>
  <p className="reading">
            The annotations and readings written for this project are under <Link href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</Link>, so commercial use needs the owner’s permission, which you can <Link href="https://arunc.dev/contact/">ask for here</Link>. The texts above keep their own terms, and the code is under the MIT licence.
          </p>
        </Section>

        <Section title="The romanised Tamil">
          <IastKey className="!text-[14px]" />
        </Section>

        <Section title="Your privacy">
          <p className="reading">The site works offline after your first visit. Your reflections and settings stay in this browser. Nothing is sent anywhere unless you connect a language model, and then only the text you choose goes to the provider you chose, directly from your browser, using your own key.</p>
        </Section>

        <Section title="The walks">
          <p className="reading">A walk starts from a situation, goes through what it can feel like, then to what the Kural sets against that, and ends at the couplets that say so. The feelings are our suggestion and are marked as such: the Kural doesn’t know your situation. Every later step cites a couplet. Where the Kural offers no way through, the walk says so rather than inventing one. Couplets that could hurt someone in distress are never part of a walk.</p>
          <p className="reading">
            Walking through a text this way comes from <Link href={REPO}>GitaViśva</Link>, Himanshu Mohanty’s knowledge graph of the Bhagavad Gita, which also inspired this site.
          </p>
        </Section>

        <Section title="The interface and code">
          <p className="reading">
            This site is a fork of <Link href={REPO}>GitaViśva</Link> by Himanshu Mohanty. Its interface and code come from that project, used under the MIT licence. Its name, its paintings and its Gita data are not used here.
          </p>
        </Section>

        <Section title="Licences">
          <p className="reading">
            See the <Link href="/NOTICE.txt">notice</Link> for the sources of the texts, and the <Link href="/third-party-notices.txt">third-party notices</Link> for the software, fonts and search model this site ships.
          </p>
        </Section>

        <Section title="Not advice">
          <p className="reading">This is a book from two thousand years ago, read by software. It isn’t medical, legal or mental health advice. If you are struggling, please talk to someone who can help.</p>
        </Section>
      </main>
    </div>
  );
}
