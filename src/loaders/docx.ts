// Word (.docx) reading with mammoth, plus metadata from the file's
// docProps/core.xml (author, title, date).
//
// Rule 1 runs first: protected .docx files are refused before mammoth sees them.

import JSZip from 'jszip';
import { assertDocxNotProtected } from '../core/copyright';
import type { DocMeta, DocPage } from '../core/types';
import { textToPages } from './text';

export interface MammothLike {
  extractRawText(input: { arrayBuffer: ArrayBuffer; buffer?: unknown }): Promise<{ value: string; messages: unknown[] }>;
}

function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(xml);
  return m?.[1]?.trim() || undefined;
}

export async function docxMeta(bytes: Uint8Array): Promise<DocMeta> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const core = await zip.file('docProps/core.xml')?.async('string');
    const app = await zip.file('docProps/app.xml')?.async('string');
    return {
      title: core ? tag(core, 'dc:title') : undefined,
      author: core ? tag(core, 'dc:creator') : undefined,
      publisher: app ? tag(app, 'Company') : undefined,
      date: core ? tag(core, 'dcterms:created')?.slice(0, 10) : undefined,
    };
  } catch {
    return {};
  }
}

export async function extractDocx(bytes: Uint8Array, mammoth: MammothLike): Promise<{ pages: DocPage[]; meta: DocMeta }> {
  assertDocxNotProtected(bytes);
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf, buffer: buf }); // browser build reads arrayBuffer, Node reads buffer
  // mammoth separates paragraphs with blank lines already.
  return { pages: textToPages(value), meta: await docxMeta(bytes) };
}
