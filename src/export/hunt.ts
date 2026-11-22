// Word Hunt exports. They contain only the hunted words, their counts and
// page numbers: never any text from the book (copyright rule 3).

import { assertExportSafe } from '../core/copyright';
import type { HuntReport } from '../hunt/search';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function huntToCsv(reports: HuntReport[]): string {
  assertExportSafe([], 0);
  const multi = reports.length > 1;
  const rows: (string | number)[][] = [[...(multi ? ['file'] : []), 'word', 'count', 'pages']];
  for (const r of reports) {
    for (const x of r.results) rows.push([...(multi ? [r.fileName ?? ''] : []), x.term, x.count, x.pages.join(' ')]);
  }
  // A byte order mark helps Excel open Arabic text correctly.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function huntToMarkdown(reports: HuntReport[], title = 'Word Hunt results'): string {
  const multi = reports.length > 1;
  const lines = [`# ${title}`, ''];
  const totalMatches = reports.reduce((n, r) => n + r.results.reduce((m, x) => m + x.count, 0), 0);
  const pages = reports.reduce((n, r) => n + r.pagesSearched, 0);
  lines.push(`- Matches: ${totalMatches}`, `- Pages searched: ${pages}`, '');
  lines.push(multi ? '| File | Word | Count | Pages |' : '| Word | Count | Pages |');
  lines.push(multi ? '|---|---|---|---|' : '|---|---|---|');
  for (const r of reports) {
    for (const x of r.results) {
      const cells = [x.term, String(x.count), x.pages.join(', ') || '(not found)'];
      if (multi) cells.unshift(r.fileName ?? '');
      lines.push(`| ${cells.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`);
    }
  }
  lines.push('', '_Made with Ankabut. Counts and page numbers only, no book text._', '');
  return lines.join('\n');
}
