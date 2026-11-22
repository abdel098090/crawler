// The study document: a clean summary to keep, in Markdown and (via the
// browser's print dialog) PDF.
//
// It holds key points as SHORT quotes with page numbers, the spider's own
// explanations (clearly labelled), keywords, the user's searches with page
// numbers, Word Hunt counts, and the user's own notes. It NEVER contains the
// book's full text: every quote passes through the copyright export guard.

import type { DocumentExplanation } from '../analysis/explain';
import { assertExportSafe, assertNoLongVerbatimRun, fitQuotesToLimit, shortenQuote } from '../core/copyright';
import type { AnalysisResult, DocMeta } from '../core/types';
import type { HuntReport } from '../hunt/search';
import type { Flashcard } from '../study/flashcards';

export interface StudyDocInput {
  title: string;
  docs: {
    fileName: string;
    meta: DocMeta;
    totalPages: number;
    /** Characters in the source document, for the export limits. */
    chars: number;
    analysis: AnalysisResult;
    explanation?: DocumentExplanation;
  }[];
  notes: string;
  searches: { query: string; count: number; pages: number[]; fileName?: string }[];
  hunts: HuntReport[];
  /** Translates a label key; defaults to English. */
  label?: (key: string) => string;
  /** Full source text, used for the "no long copy" safety check. */
  sourceText?: string;
  date?: string;
}

const EN_LABELS: Record<string, string> = {
  studyDocument: 'Study document',
  source: 'Source',
  author: 'Author',
  publisher: 'Publisher',
  date: 'Date',
  coverage: 'Coverage',
  pagesRead: 'pages read',
  skipped: 'Skipped pages',
  spiderExplains: 'The spider explains',
  explanationNote: 'These lines are the spider’s own explanation, built from the keywords. Check them against the quotes and pages.',
  keyPoints: 'Key points (short quotes with page numbers)',
  keywords: 'Keywords',
  searches: 'My searches',
  wordHunt: 'Word Hunt',
  notes: 'My notes',
  page: 'p.',
  footer: 'Made with Ankabut. Short quotes only, for personal study. The full text of the source is not included.',
  motto: 'I help you read. I don’t read for you.',
};

interface Prepared {
  input: StudyDocInput;
  L: (k: string) => string;
  quotesByDoc: { text: string; page: number; file?: string }[][];
}

function prepare(input: StudyDocInput): Prepared {
  const L = (k: string) => input.label?.(k) ?? EN_LABELS[k] ?? k;
  const totalChars = input.docs.reduce((n, d) => n + d.chars, 0);
  // Pick the quotes in priority order, then fit them inside the copyright limits.
  const wanted = input.docs.flatMap((d, di) => d.analysis.keyPoints.filter((k) => k.kind === 'quote').map((k) => ({ text: k.text, page: k.source.page, file: d.fileName, di })));
  const kept = fitQuotesToLimit(wanted, totalChars);
  assertExportSafe(kept, totalChars);
  const quotesByDoc = input.docs.map((_, di) => kept.filter((q) => q.di === di).map(({ text, page, file }) => ({ text, page, file })));
  return { input, L, quotesByDoc };
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|');
}

export function buildStudyMarkdown(input: StudyDocInput): string {
  const { L, quotesByDoc } = prepare(input);
  const out: string[] = [`# ${input.title}`, '', `_${L('studyDocument')}${input.date ? ` · ${input.date}` : ''}_`, ''];
  input.docs.forEach((d, di) => {
    if (input.docs.length > 1) out.push(`## ${d.fileName}`, '');
    const meta = [
      [L('source'), d.meta.title ? `${d.meta.title} (${d.fileName})` : d.fileName],
      [L('author'), d.meta.author],
      [L('publisher'), d.meta.publisher],
      [L('date'), d.meta.date],
    ].filter(([, v]) => v);
    for (const [k, v] of meta) out.push(`- **${k}:** ${v}`);
    const c = d.analysis.coverage;
    out.push(`- **${L('coverage')}:** ${c.readPages}/${c.totalPages} ${L('pagesRead')}`);
    const realSkips = c.skipped.filter((s) => !s.reason.includes('outside'));
    if (realSkips.length) out.push(`- **${L('skipped')}:** ${realSkips.map((s) => `${s.page} (${s.reason})`).join(', ')}`);
    out.push('');
    if (d.explanation?.overview) {
      out.push(`### ${L('spiderExplains')}`, '', `> ${L('explanationNote')}`, '', `- ${d.explanation.overview.text}`);
      for (const p of d.explanation.parts) out.push(`- ${p.point.text}`);
      out.push('');
    }
    out.push(`### ${L('keyPoints')}`, '');
    for (const q of quotesByDoc[di]) out.push(`- “${q.text}” (${L('page')} ${q.page})`);
    out.push('', `### ${L('keywords')}`, '', d.analysis.keywords.slice(0, 25).map((k) => `${k.display} (${k.count})`).join(' · '), '');
  });
  if (input.searches.length) {
    out.push(`## ${L('searches')}`, '', '| Search | Count | Pages |', '|---|---|---|');
    for (const s of input.searches) out.push(`| ${mdEscape(s.query)}${s.fileName ? ` (${mdEscape(s.fileName)})` : ''} | ${s.count} | ${s.pages.join(', ') || '—'} |`);
    out.push('');
  }
  if (input.hunts.length) {
    out.push(`## ${L('wordHunt')}`, '', '| Word | Count | Pages |', '|---|---|---|');
    for (const r of input.hunts) for (const x of r.results) out.push(`| ${mdEscape(x.term)}${input.hunts.length > 1 ? ` (${mdEscape(r.fileName ?? '')})` : ''} | ${x.count} | ${x.pages.join(', ') || '—'} |`);
    out.push('');
  }
  if (input.notes.trim()) out.push(`## ${L('notes')}`, '', input.notes.trim(), '');
  out.push('---', '', `_${L('motto')}_`, '', `_${L('footer')}_`, '');
  const md = out.join('\n');
  if (input.sourceText) assertNoLongVerbatimRun(md.replace(input.notes, ''), input.sourceText);
  return md;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The same content as HTML, laid out for printing to PDF. */
export function buildStudyHtml(input: StudyDocInput, rtl = false): string {
  const md = buildStudyMarkdown(input);
  // A small Markdown-to-HTML conversion for exactly the shapes buildStudyMarkdown writes.
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;
  let inTable = false;
  const closeAll = () => {
    if (inList) html.push('</ul>');
    if (inTable) html.push('</table>');
    inList = false;
    inTable = false;
  };
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>');
  for (const line of lines) {
    if (/^#{1,3} /.test(line)) {
      closeAll();
      const level = line.match(/^#+/)![0].length;
      html.push(`<h${level} dir="auto">${inline(line.replace(/^#+ /, ''))}</h${level}>`);
    } else if (line.startsWith('- ')) {
      if (inTable) closeAll();
      if (!inList) html.push('<ul>');
      inList = true;
      html.push(`<li dir="auto">${inline(line.slice(2))}</li>`);
    } else if (line.startsWith('|')) {
      if (/^\|[-| ]+\|$/.test(line)) continue;
      if (inList) closeAll();
      if (!inTable) html.push('<table>');
      inTable = true;
      const cells = line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
      html.push(`<tr>${cells.map((c) => `<td dir="auto">${inline(c)}</td>`).join('')}</tr>`);
    } else if (line.startsWith('> ')) {
      closeAll();
      html.push(`<p class="note">${inline(line.slice(2))}</p>`);
    } else if (line === '---') {
      closeAll();
      html.push('<hr>');
    } else if (line.trim()) {
      closeAll();
      html.push(`<p dir="auto">${inline(line)}</p>`);
    } else closeAll();
  }
  closeAll();
  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(input.title)}</title>
<style>
body{font-family:"Segoe UI","Noto Sans Arabic","Noto Sans",Tahoma,sans-serif;line-height:1.55;color:#1d2428;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:24px;margin-bottom:4px}h2{font-size:19px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}h3{font-size:16px;margin-top:20px}
li{margin:4px 0}table{border-collapse:collapse;width:100%;font-size:13px}td{border:1px solid #ddd;padding:4px 6px;text-align:start}
.note{color:#555;font-size:13px;border-inline-start:3px solid #1f7a7f;padding-inline-start:8px}
@page{margin:18mm}
</style></head><body>${html.join('\n')}</body></html>`;
}

/** Anki import file: front TAB back TAB tags. Backs are short quotes with their page. */
export function flashcardsToAnki(cards: Flashcard[], documentChars: number, fileName = ''): string {
  const quotes = cards.map((c) => ({ text: c.kind === 'term' ? shortenQuote(c.back) : c.front.replace('_____', '…'), page: c.source.page }));
  const kept = fitQuotesToLimit(quotes, documentChars);
  assertExportSafe(kept, documentChars);
  const clean = (s: string) => s.replace(/[\t\n]+/g, ' ');
  const tag = `ankabut ${fileName.replace(/[^\p{L}\p{N}]+/gu, '_')}`.trim();
  const rows = cards.slice(0, kept.length).map((c) => {
    const page = `(p. ${c.source.page})`;
    const front = c.kind === 'term' ? c.front : shortenQuote(c.front);
    const back = c.kind === 'term' ? `${shortenQuote(c.back)} ${page}` : `${c.back} ${page}`;
    return `${clean(front)}\t${clean(back)}\t${tag}`;
  });
  return ['#separator:tab', '#html:false', '#tags column:3', ...rows].join('\n') + '\n';
}
