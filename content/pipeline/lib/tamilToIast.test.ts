import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { foldToAscii, fromRevisedIast, toLetterForLetter, toRevisedIast } from './tamilToIast.ts';

describe('the essay\'s rules', () => {
  it('reproduces the essay\'s worked example', () => {
    assert.equal(toRevisedIast('கொடுத்தான்'), 'koduṭṭāṉ');
  });

  it('keeps short and long e and o distinct', () => {
    assert.equal(toRevisedIast('எ ஏ ஒ ஓ'), 'e ē o ō');
    assert.equal(toRevisedIast('கெ கே கொ கோ'), 'ke kē ko kō');
  });

  it('swaps t and ṭ, d and ḍ from standard IAST', () => {
    assert.equal(toRevisedIast('தமிழ்'), 'ṭamiḻ');
    assert.equal(toRevisedIast('நாடு'), 'nādu');
    assert.equal(toRevisedIast('முதல'), 'muḍala');
  });

  it('never emits capitals', () => {
    assert.equal(toRevisedIast('அகர முதல எழுத்தெல்லாம் ஆதி'), toRevisedIast('அகர முதல எழுத்தெல்லாம் ஆதி').toLowerCase());
  });
});

describe('hard consonants by position', () => {
  for (const [tamil, roman, why] of [
    ['பகவன்', 'pagavaṉ', 'between vowels'],
    ['அன்பு', 'aṉbu', 'after a nasal'],
    ['நெஞ்சம்', 'neñjam', 'ச after a nasal'],
    ['வாழ்க', 'vāḻga', 'after a sonorant'],
    ['கற்க', 'kaṟka', 'after a stop'],
    ['மக்கள்', 'makkaḷ', 'doubled'],
    ['பச்சை', 'paccai', 'doubled ச'],
    ['அஃது', 'aḵṭu', 'after aytham'],
    ['சிறப்பு', 'ciṟappu', 'ச at word start'],
  ] as const) {
    it(`${tamil} is ${roman} (${why})`, () => assert.equal(toRevisedIast(tamil), roman));
  }
});

describe('decisions by the essay\'s author', () => {
  it('keeps ச hard at the start of a word', () => {
    assert.equal(toRevisedIast('சிறப்பு'), 'ciṟappu');
  });

  it('leaves ற clusters alone', () => {
    assert.equal(toRevisedIast('ஒன்று'), 'oṉṟu');
  });

  it('writes த as ṭ, so தமிழ் is ṭamiḻ', () => {
    assert.equal(toRevisedIast('தமிழ்'), 'ṭamiḻ');
  });
});

describe('spaces in the verse', () => {
  it('voices a stop joined to its nasal across a metrical space', () => {
    assert.equal(toRevisedIast('தான்முந் துறும்'), 'ṭāṉmun ḍuṟum');
  });

  it('voices த after ந் even between two separate words', () => {
    assert.equal(toRevisedIast('சூழினுந் தான்'), 'cūḻiṉun ḍāṉ');
  });

  it('leaves a stop unvoiced after an ordinary word ending', () => {
    assert.equal(toRevisedIast('உலகம் பெரிது'), 'ulagam periḍu');
  });

  it('keeps a doubled stop voiceless across a space', () => {
    assert.equal(toRevisedIast('நாடாச் சிறப்பு'), 'nādāc ciṟappu');
  });
});

describe('junctions', () => {
  it('hyphenates a vowel letter inside a word', () => {
    assert.equal(toRevisedIast('அன்புஈனும்'), 'aṉbu-īṉum');
    assert.equal(toRevisedIast('உழாஅர்'), 'uḻā-ar');
  });
});

describe('round trip', () => {
  for (const line of ['கொடுத்தான்', 'அன்புஈனும் ஆர்வம் உடைமை அதுஈனும்', 'நண்பு என்னும் நாடாச் சிறப்பு.', 'உழாஅர்', 'அஃது']) {
    it(line, () => assert.equal(fromRevisedIast(toRevisedIast(line)), line));
  }

  it('normalises repeated spaces first', () => {
    assert.equal(toRevisedIast('பகவன்  முதற்றே'), 'pagavaṉ muḍaṟṟē');
  });
});

describe('search forms', () => {
  it('folds to what people type', () => {
    assert.equal(foldToAscii('aṉbu'), 'anbu');
    assert.equal(foldToAscii('aṟam'), 'aram');
    assert.equal(foldToAscii('ṭamiḻ'), 'tamil');
    assert.equal(foldToAscii('aṉbu-īṉum'), 'anbu inum');
  });

  it('keeps a letter-for-letter form for the index', () => {
    assert.equal(toLetterForLetter('அன்பு'), 'aṉpu');
    assert.equal(toLetterForLetter('கொடுத்தான்'), 'koṭuttāṉ');
  });
});
