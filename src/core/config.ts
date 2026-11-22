// Which version of the app is running?
//
// The user version is the normal build. The developer version is built with
// `npm run dev:developer` or `npm run build:developer` (Vite "mode" = developer).
// It shows debug info: timings, extraction logs and the spider's planned route.
// Copyright rules 1 to 3 stay on in both versions (see copyright.ts).

function readMode(): string {
  try {
    return (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE ?? 'production';
  } catch {
    return 'production';
  }
}

export const DEVELOPER_MODE = readMode() === 'developer';
