// OCR (optical character recognition) in the browser with tesseract.js.
//
// It is loaded only when needed, because it is big. Your file is never sent
// anywhere: the recognition runs on your device. The first time, the browser
// downloads the OCR engine and the Arabic/French/English language data
// (not your file) and then caches them.

type TesseractWorker = {
  recognize(image: HTMLCanvasElement | Blob | File): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(async (mod) => {
      const createWorker = (mod as unknown as { createWorker: (langs: string[]) => Promise<TesseractWorker> }).createWorker;
      return createWorker(['ara', 'fra', 'eng', 'spa']);
    });
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function ocrImage(image: HTMLCanvasElement | Blob | File): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text;
}

/** Renders one PDF page to a canvas (2x scale for sharper OCR) and runs OCR on it. */
export async function ocrPdfPage(page: unknown): Promise<string | null> {
  type Viewport = { width: number; height: number };
  const p = page as {
    getViewport(o: { scale: number }): Viewport;
    render(o: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: Viewport }): { promise: Promise<void> };
  };
  if (typeof document === 'undefined' || !p.getViewport) return null;
  const viewport = p.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await p.render({ canvas, canvasContext: ctx, viewport }).promise;
  // Full sentences again; picture labels are kept, but at the end of the page so they do not cut sentences.
  const { cleanOcrText } = await import('./ocrclean');
  const { text, labels } = cleanOcrText(await ocrImage(canvas));
  return labels.length ? `${text}\n\n${labels.join(' · ')}` : text;
}

export async function shutdownOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise.catch(() => null);
    workerPromise = null;
    await w?.terminate();
  }
}
