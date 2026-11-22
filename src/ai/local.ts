// Optional local AI through Ollama (https://ollama.com), running on the
// student's own computer. Off by default.
//
// Privacy rules, enforced here:
// - Only addresses on this computer are allowed (localhost, 127.0.0.1, ::1).
//   Any other address is refused, so the text can never go to the internet.
// - The AI only receives the pages being studied, never the whole library.
// - The answer is always shown as "AI answer, can be wrong", with the page to check.

import type { Lang } from '../core/types';

export const DEFAULT_URL = 'http://localhost:11434';

/** True only for addresses on this same computer. */
export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

function base(url: string): string {
  if (!isLocalUrl(url)) throw new Error('Only a local AI on this computer is allowed.');
  return url.replace(/\/+$/, '');
}

type Fetch = typeof fetch;

/** The models installed in Ollama, smallest first. Throws when Ollama is not running. */
export async function listModels(url = DEFAULT_URL, f: Fetch = fetch): Promise<{ name: string; size: number }[]> {
  const r = await f(`${base(url)}/api/tags`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`Ollama answered ${r.status}`);
  const data = (await r.json()) as { models?: { name: string; size: number }[] };
  // Embedding models cannot chat.
  return (data.models ?? []).filter((m) => !/embed/i.test(m.name)).sort((a, b) => a.size - b.size);
}

const LANG_NAME: Record<Lang, string> = { en: 'English', fr: 'French', ar: 'Arabic', es: 'Spanish' };

export interface Excerpt {
  page: number;
  text: string;
}

/** Keeps the excerpt small enough for a small model: the asked page first, then its neighbours. */
export function pickExcerpts(pages: Excerpt[], page: number, maxChars = 6000): Excerpt[] {
  const order = [page, page - 1, page + 1, page - 2, page + 2];
  const out: Excerpt[] = [];
  let used = 0;
  for (const n of order) {
    const p = pages.find((x) => x.page === n);
    if (!p || !p.text.trim()) continue;
    const room = maxChars - used;
    if (room < 200) break;
    const text = p.text.length > room ? `${p.text.slice(0, room)}…` : p.text;
    out.push({ page: n, text });
    used += text.length;
  }
  return out.sort((a, b) => a.page - b.page);
}

/** The instructions that keep the AI on the book: answer from the pages only, cite pages, say when it is not there. */
export function buildMessages(question: string, excerpts: Excerpt[], lang: Lang): { role: 'system' | 'user'; content: string }[] {
  const system = [
    'You are a patient study helper for a student.',
    `Answer in ${LANG_NAME[lang]}, in simple words, in at most 6 short sentences.`,
    'Use ONLY the book pages given below. Do not add facts from outside them.',
    'After each idea, write the page it comes from, like (p. 12).',
    'If the pages do not contain the answer, say clearly that the pages do not say it. Do not guess.',
    'If the text has broken math (like x2 for x squared), say that the formula should be checked on the real page.',
  ].join(' ');
  const pages = excerpts.map((e) => `--- Page ${e.page} ---\n${e.text}`).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: `Book pages:\n\n${pages}\n\nQuestion: ${question}` },
  ];
}

/** Streams the answer word by word. Call the returned abort() to stop. */
export function ask(
  opts: { url?: string; model: string; question: string; excerpts: Excerpt[]; lang: Lang; onToken: (t: string) => void },
  f: Fetch = fetch,
): { done: Promise<string>; abort: () => void } {
  const ctrl = new AbortController();
  const done = (async () => {
    const r = await f(`${base(opts.url ?? DEFAULT_URL)}/api/chat`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: opts.model, stream: true, options: { temperature: 0.2 }, messages: buildMessages(opts.question, opts.excerpts, opts.lang) }),
    });
    if (!r.ok || !r.body) throw new Error(`Ollama answered ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      // Ollama sends one JSON object per line.
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { message?: { content?: string }; error?: string };
        if (msg.error) throw new Error(msg.error);
        const piece = msg.message?.content ?? '';
        if (piece) {
          full += piece;
          opts.onToken(piece);
        }
      }
    }
    return full;
  })();
  return { done, abort: () => ctrl.abort() };
}
