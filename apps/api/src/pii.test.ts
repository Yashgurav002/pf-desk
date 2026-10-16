import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Faker, en_IN, en } from '@faker-js/faker';
import { Pii, redact } from './pii.ts';

test('each kind is tokenized', () => {
  const p = new Pii([{ kind: 'NAME', value: 'Ramesh Krishna Patil' }, { kind: 'UAN', value: '100123456789' }]);
  const out = p.tokenize(
    'ramesh  krishna PATIL, UAN 1001 2345 6789, Aadhaar 2345-6789-0123, PAN ABCDE1234F, IFSC SBIN0001234, ' +
    'a/c 12345678901, ph +91 98765 43210, mail ramesh.p@example.com, amt Rs. 12,500 and ₹3000',
  );
  for (const t of ['[NAME_1]', '[UAN_1]', '[AADHAAR_1]', '[PAN_1]', '[IFSC_1]', '[ACC_1]', '[PHONE_1]', '[EMAIL_1]', '[AMT_1]', '[AMT_2]'])
    assert.ok(out.includes(t), `${t} missing in: ${out}`);
  assert.doesNotMatch(out, /\d{4}/);
});

test('same original -> same token; round trip', () => {
  const p = new Pii();
  const text = 'Call 9876543210 or 98765 43210. Account 123456789012345 again 123456789012345.';
  const out = p.tokenize(text);
  assert.equal(out, 'Call [PHONE_1] or [PHONE_1]. Account [ACC_1] again [ACC_1].');
  assert.equal(p.detokenize('Reply to [PHONE_1] about [ACC_1]', { full: true }), 'Reply to 9876543210 about 123456789012345');
  assert.equal(p.detokenize('Reply to [PHONE_1] about [ACC_1]'), 'Reply to XXXXXX3210 about XXXXXXXXXXX2345'); // model output: masked
  const q = new Pii([{ kind: 'NAME', value: 'Sunita Deshmukh' }]);
  assert.equal(q.detokenize(q.tokenize('Dear Sunita Deshmukh, PAN abcde1234f'), { full: true }), 'Dear Sunita Deshmukh, PAN abcde1234f');
});

test('add returns stable token; redact is standalone', () => {
  const p = new Pii();
  assert.equal(p.add('NAME', 'Asha Pawar'), '[NAME_1]');
  assert.equal(p.add('NAME', 'asha  pawar'), '[NAME_1]');
  assert.equal(redact('UAN 100987654321 ok'), 'UAN [AADHAAR_1] ok');
});

test('red team: 200 generated strings leak nothing', () => {
  const f = new Faker({ locale: [en_IN, en], seed: 7 });
  const templates = [
    (n: string, ph: string, acc: string, pan: string, aad: string) => `${n} ka PF claim reject hua, unka phone ${ph} hai aur khata ${acc}.`,
    (n: string, ph: string, acc: string, pan: string, aad: string) => `Please call ${n} on ${ph}; PAN ${pan}, Aadhaar ${aad}.`,
    (n: string, ph: string, acc: string, pan: string, aad: string) => `मेरा नाम ${n} है, मेरा नंबर ${ph} और खाता ${acc} है।`,
    (n: string, ph: string, acc: string, pan: string, aad: string) => `Bank a/c no:${acc} IFSC MAHB0000${f.string.numeric(3)} of ${n.toUpperCase()} (aadhaar ${aad})`,
    (n: string, ph: string, acc: string, pan: string, aad: string) => `${n} (${pan}) ne ₹${f.number.int({ min: 1000, max: 900000 })} maanga. Mob: 0${ph}`,
  ];
  for (let i = 0; i < 200; i++) {
    const name = `${f.person.firstName()} ${f.person.lastName()}`;
    const ph = f.helpers.arrayElement(['6', '7', '8', '9']) + f.string.numeric(9);
    const phFmt = f.helpers.arrayElement([ph, `+91 ${ph.slice(0, 5)} ${ph.slice(5)}`, `+91-${ph}`]);
    const acc = f.string.numeric({ length: f.number.int({ min: 9, max: 18 }), allowLeadingZeros: false });
    const pan = f.string.alpha({ length: 5, casing: 'upper' }) + f.string.numeric(4) + f.string.alpha({ length: 1, casing: 'upper' });
    const aadRaw = f.string.numeric({ length: 12, allowLeadingZeros: false });
    const aad = f.helpers.arrayElement([aadRaw, aadRaw.replace(/(\d{4})(?=\d)/g, '$1 '), aadRaw.replace(/(\d{4})(?=\d)/g, '$1-')]);
    const text = templates[i % templates.length](name, phFmt, acc, pan, aad);
    const p = new Pii([{ kind: 'NAME', value: name }]);
    const out = p.tokenize(text);
    for (const secret of [name, ph, acc, pan, aadRaw]) {
      const flat = out.replace(/[\s-]/g, '').toLowerCase();
      assert.ok(!flat.includes(secret.replace(/\s/g, '').toLowerCase()), `leak of "${secret}" in: ${out}`);
    }
    assert.doesNotMatch(out, /\d{5,}/, `digit run left in: ${out}`);
    assert.equal(p.detokenize(out, { full: true }).toLowerCase(), text.toLowerCase()); // case-insensitive match restores the canonical spelling
  }
});

test('model cannot unlock identifiers it was never sent', () => {
  // the prompt mentions "[UAN_1]" as a format example; a model echoing it must not get the real UAN back
  const p = new Pii([{ kind: 'NAME', value: 'Kannen Bhat' }, { kind: 'UAN', value: '105648706259' }]);
  const sent = p.tokenize('Identifiers appear as tokens like [NAME_1] or [UAN_1]. Father name differs for Kannen Bhat (UAN record).');
  assert.ok(!sent.includes('105648706259'));
  const reply = p.detokenize('Mismatch between the UAN ([UAN_1]) and the bank for [NAME_1].');
  assert.ok(!reply.includes('105648706259') && !reply.includes('6259'), reply);
  assert.match(reply, /Kannen Bhat/);
  // a UAN that was sent comes back masked
  const q = new Pii([{ kind: 'UAN', value: '105648706259' }]);
  assert.equal(q.detokenize(q.tokenize('UAN 105648706259')), 'UAN XXXXXXXX6259');
});
