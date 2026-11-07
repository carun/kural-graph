import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMadurai, parseParimelazhagar, parseWikisource } from './03-parse-tamil.ts';

const couplet = (n: number, label = n) => `அகர முதல<br>\nபகவன் உலகு. &nbsp; ${label}<br>\n`;

describe('Madurai parser', () => {
  it('pairs by order, so its known misprints do not lose couplets', () => {
    const html = `<h3>heading</h3>\n${Array.from({ length: 71 }, (_, i) => couplet(i + 1)).join('')}${couplet(72, 71)}`;
    const parsed = parseMadurai(html);
    assert.equal(parsed.size, 72);
    assert.equal(parsed.get(72)?.line2, 'பகவன் உலகு.');
  });

  it('rejects a misnumbering it does not know about', () => {
    assert.throws(() => parseMadurai(`<h3>heading</h3>\n${couplet(1, 9)}`), /not a known misprint/);
  });

  it('joins a first line that wraps', () => {
    const parsed = parseMadurai('<h3>heading</h3>\nஅகர<br>\nமுதல<br>\nபகவன் 1<br>\n');
    assert.equal(parsed.get(1)?.line1, 'அகர முதல');
  });
});

describe('Wikisource parser', () => {
  it('reads both couplet markers and repairs the doubled 71', () => {
    const parsed = parseWikisource({
      '1': { revid: 1, text: '<poem>அகர\nமுதல {{Pline|71|r}}\n\nபகவன்\nஉலகு {{Pline|71|r}}</poem>' },
      '2': { revid: 2, text: 'ஊடுதல்\nகூடி {{float_right|1330}}' },
    });
    assert.equal(parsed.get(71)?.line1, 'அகர');
    assert.equal(parsed.get(72)?.line1, 'பகவன்');
    assert.equal(parsed.get(1330)?.line2, 'கூடி');
  });
});

describe('Parimelazhagar parser', () => {
  it('reads the verse under each heading style', () => {
    const parsed = parseParimelazhagar({
      a: { revid: 1, text: "==குறள் 851 (இகலென்ப ) ==\n\n'''இகலென்ப வெல்லா''' ( ) '''<FONT>இகல் என்ப</FONT>'''\n\n'''பண்பின்மை நோய்.''' (01) '''<FONT>பண்பு</FONT>'''\n" },
      b: { revid: 2, text: '===திருக்குறள்: 82 (விருந்துபுறத்)===\n\n;விருந்து புறத்ததாத் |{{red|}}\n;மருந்தெனினும் றன்று.  (02)|{{red|}}\n' },
    });
    assert.deepEqual(parsed.get(851)?.joined, ['இகலென்ப வெல்லா', 'பண்பின்மை நோய்.']);
    assert.deepEqual(parsed.get(82)?.joined, ['விருந்து புறத்ததாத்', 'மருந்தெனினும் றன்று.']);
  });
});
