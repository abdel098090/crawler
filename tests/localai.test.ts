import { describe, expect, it } from 'vitest';
import { ask, buildMessages, isLocalUrl, listModels, pickExcerpts } from '../src/ai/local';

describe('local AI (Ollama)', () => {
  it('only allows this computer', () => {
    expect(isLocalUrl('http://localhost:11434')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalUrl('http://[::1]:11434')).toBe(true);
    expect(isLocalUrl('http://example.com:11434')).toBe(false);
    expect(isLocalUrl('http://localhost.evil.com')).toBe(false);
    expect(isLocalUrl('http://192.168.1.5:11434')).toBe(false);
    expect(isLocalUrl('file:///etc/passwd')).toBe(false);
    expect(isLocalUrl('not a url')).toBe(false);
  });

  it('refuses to send anything to an internet address', async () => {
    let called = false;
    const f = (async () => {
      called = true;
      return new Response('{}');
    }) as typeof fetch;
    await expect(listModels('https://api.example.com', f)).rejects.toThrow(/local/);
    const r = ask({ url: 'https://api.example.com', model: 'm', question: 'q', excerpts: [], lang: 'en', onToken: () => {} }, f);
    await expect(r.done).rejects.toThrow(/local/);
    expect(called).toBe(false);
  });

  it('sends only nearby pages, and not too much text', () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: `page ${i + 1} `.repeat(300) }));
    const ex = pickExcerpts(pages, 5, 6000);
    expect(ex[0].page).toBeGreaterThanOrEqual(3);
    expect(ex.every((e) => e.page >= 3 && e.page <= 7)).toBe(true);
    expect(ex.some((e) => e.page === 5)).toBe(true);
    expect(ex.reduce((n, e) => n + e.text.length, 0)).toBeLessThanOrEqual(6001);
  });

  it('tells the AI to stay on the book, cite pages and answer in the right language', () => {
    const [sys, user] = buildMessages('What is a gateway?', [{ page: 3, text: 'The gateway is the router.' }], 'es');
    expect(sys.content).toMatch(/ONLY the book pages/);
    expect(sys.content).toMatch(/\(p\. 12\)/);
    expect(sys.content).toMatch(/Spanish/);
    expect(user.content).toContain('--- Page 3 ---');
    expect(user.content).toContain('Question: What is a gateway?');
  });

  it('reads the streamed answer and lists chat models only', async () => {
    const body = ['{"message":{"content":"The gate"}}', '{"message":{"content":"way (p. 3)."}}', '{"done":true}'].join('\n') + '\n';
    const f = (async (url: string) =>
      String(url).endsWith('/api/tags')
        ? new Response(JSON.stringify({ models: [{ name: 'big', size: 9 }, { name: 'nomic-embed-text', size: 1 }, { name: 'small', size: 2 }] }))
        : new Response(body)) as unknown as typeof fetch;
    expect((await listModels(undefined, f)).map((m) => m.name)).toEqual(['small', 'big']);
    const pieces: string[] = [];
    const r = ask({ model: 'small', question: 'q', excerpts: [{ page: 3, text: 't' }], lang: 'en', onToken: (t) => pieces.push(t) }, f);
    expect(await r.done).toBe('The gateway (p. 3).');
    expect(pieces).toEqual(['The gate', 'way (p. 3).']);
  });
});
