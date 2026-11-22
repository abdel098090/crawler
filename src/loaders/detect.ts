// Detects what kind of file we got, from its first bytes first and its
// name second. Bytes are more honest than names: a file called "book.pdf"
// that is really a ZIP will be treated as a ZIP.

import { assertNotDrmFormat, ProtectedFileError } from '../core/copyright';
import type { FileKind } from '../core/types';

export function detectKind(fileName: string, head: Uint8Array): FileKind {
  assertNotDrmFormat(fileName);
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const ascii = String.fromCharCode(...head.slice(0, 8));
  if (ascii.startsWith('%PDF')) return 'pdf';
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
    // OLE container: an old .doc, or an encrypted / rights-managed .docx.
    throw new ProtectedFileError(
      ext === 'docx' ? 'password' : 'unsupported',
      ext === 'docx'
        ? 'This Word file is password protected or rights managed. Ankabut does not open protected files.'
        : 'Old .doc files are not supported. Please save it as .docx.',
    );
  }
  if (head[0] === 0x50 && head[1] === 0x4b) {
    if (ext === 'docx' || ext === 'zip' || ext === '') return 'docx';
    throw new ProtectedFileError('unsupported', 'This archive type is not supported.');
  }
  if (head[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'image';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image';
  if (ascii.startsWith('RIFF') && ['webp'].includes(ext)) return 'image';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) return 'image';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (['txt', 'text', 'csv', 'log', ''].includes(ext)) return 'txt';
  // Unknown extension: accept it as text only if it decodes as readable text.
  const sample = new TextDecoder('utf-8', { fatal: false }).decode(head);
  const bad = (sample.match(/[\u0000-\u0008\u000E-\u001F�]/g)?.length ?? 0) / Math.max(1, sample.length);
  if (bad < 0.02) return 'txt';
  throw new ProtectedFileError('unsupported', 'This file type is not supported. Try PDF, Word (.docx), text or Markdown.');
}

/** Decodes text files. Tries UTF-8 first, then Windows Arabic (cp1256) and Latin-1. */
export function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  for (const enc of ['windows-1256', 'windows-1252']) {
    try {
      return new TextDecoder(enc).decode(bytes);
    } catch {
      /* encoding not available, try the next one */
    }
  }
  return utf8;
}
