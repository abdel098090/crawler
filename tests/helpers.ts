import type { LoadedDoc } from '../src/core/types';

const TOPICS = [
  ['firewall', 'packet', 'rule', 'port'],
  ['encryption', 'cipher', 'key', 'certificate'],
  ['phishing', 'email', 'attacker', 'password'],
  ['malware', 'virus', 'payload', 'sandbox'],
  ['routing', 'router', 'subnet', 'gateway'],
  ['logging', 'audit', 'event', 'alert'],
  ['backup', 'restore', 'snapshot', 'archive'],
  ['wireless', 'antenna', 'handshake', 'channel'],
  ['identity', 'token', 'session', 'login'],
  ['database', 'query', 'injection', 'table'],
];

/** Builds a fake book: each block of 30 pages talks about one topic, with chapter titles. */
export function makeBook(pages = 300, id = 'book'): LoadedDoc {
  const out = [];
  for (let n = 1; n <= pages; n++) {
    const topicIndex = Math.min(TOPICS.length - 1, Math.floor(((n - 1) * TOPICS.length) / pages));
    const [a, b, c, d] = TOPICS[topicIndex];
    const lines: string[] = [];
    if ((n - 1) % Math.ceil(pages / TOPICS.length) === 0) lines.push(`Chapter ${topicIndex + 1}: The ${a}`);
    const verbs = ['checks', 'protects', 'blocks', 'reports', 'logs', 'scans', 'tracks', 'limits', 'filters'];
    const extras = ['quickly', 'daily', 'remotely', 'safely', 'silently', 'manually', 'twice', 'early', 'locally'];
    for (let s = 0; s < 18; s++) {
      const v = verbs[(s + n) % verbs.length];
      const e = extras[(s * 7 + n) % extras.length];
      lines.push(
        `On page ${n} the ${a} ${v} the ${b} ${e} and every ${c} matters because the ${d} number ${s + n} is reviewed by the ${verbs[(s * 3 + n * 5) % verbs.length]} team.`,
      );
    }
    out.push({ number: n, text: lines.join(' '), scanned: false });
  }
  // put chapter headings on their own line
  for (const p of out) p.text = p.text.replace(/^(Chapter \d+: The \w+) /, '$1\n');
  return { id, fileName: `${id}.txt`, kind: 'txt', pages: out, meta: {}, warnings: [], log: [] };
}

export function docFromText(texts: string[], id = 'doc'): LoadedDoc {
  return {
    id,
    fileName: `${id}.txt`,
    kind: 'txt',
    pages: texts.map((t, i) => ({ number: i + 1, text: t, scanned: false })),
    meta: {},
    warnings: [],
    log: [],
  };
}
