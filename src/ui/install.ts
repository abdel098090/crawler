// Phone install (PWA: Progressive Web App).
// - Registers dist/sw.js so the app opens with no internet.
// - 📲 Install button when the browser offers it (Android, Chrome, Edge).
// - iPhone has no install button: Settings shows "Share, then Add to Home Screen".
// - A new version waits for the student to tap Reload, so an open page never breaks.

import type { App } from './app';
import { h, toast } from './dom';
import { t } from './i18n';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installed = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function installPwa(app: App): void {
  let offlineReady = false;
  let prompt: InstallPrompt | null = null;
  const btn = h('button', { class: 'btn', style: { display: 'none' }, title: t('installTitle') }, `📲 ${t('install')}`) as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') btn.style.display = 'none';
    prompt = null;
  });
  app.els.controls.append(btn);

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e as InstallPrompt;
    btn.style.display = '';
  });
  addEventListener('appinstalled', () => {
    btn.style.display = 'none';
    toast(`📲 ${t('installedNow')}`, 6000);
  });
  addEventListener('offline', () => toast(`📴 ${t('offlineNow')}`, 7000));

  // Reload ONLY when the student tapped Reload. On the very first visit the new
  // service worker takes control by itself (clients.claim): reloading then would
  // throw away a file the student just opened (bug caught by CI on 2026-11-22).
  let userAskedReload = false;
  const showUpdate = (worker: ServiceWorker) => {
    if (document.querySelector('.update-bar')) return;
    const bar = h(
      'div',
      { class: 'update-bar', role: 'status' },
      `✨ ${t('updateReady')}`,
      h('button', { class: 'btn primary small', onclick: () => { userAskedReload = true; worker.postMessage('skip-waiting'); } }, t('reload')),
      h('button', { class: 'btn small', 'aria-label': t('close'), onclick: () => bar.remove() }, '✕'),
    );
    document.body.append(bar);
  };

  // Only the built app has sw.js; a service worker also needs HTTPS (or localhost).
  if (import.meta.env.PROD && 'serviceWorker' in navigator && isSecureContext) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !userAskedReload) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => {
            if (nw.state !== 'installed') return;
            if (navigator.serviceWorker.controller) showUpdate(nw);
            else {
              offlineReady = true;
              toast(`✅ ${t('offlineReady')}`, 6000);
            }
          });
        });
        return navigator.serviceWorker.ready;
      })
      .then(() => (offlineReady = true))
      .catch(() => {
        /* the app still works online */
      });
  }

  // Settings: how to install, and whether it already works offline.
  app.settingsExtras.push(() => {
    const status = installed()
      ? `✅ ${t('installStatusInstalled')}`
      : !isSecureContext
        ? `⚠️ ${t('installStatusHttp')}`
        : offlineReady
          ? `✅ ${t('offlineReady')}`
          : import.meta.env.PROD
            ? `⏳ ${t('installStatusSaving')}`
            : `ℹ️ ${t('installStatusDev')}`;
    return h(
      'div',
      { class: 'settings-block' },
      h('h3', {}, `📲 ${t('installHeading')}`),
      h('p', { class: 'muted', role: 'status', style: { fontSize: '13px' } }, status),
      prompt ? h('button', { class: 'btn primary', onclick: () => btn.click() }, `📲 ${t('install')}`) : null,
      h(
        'ol',
        { class: 'install-steps' },
        ...(isIos() ? [t('iosStep1'), t('iosStep2'), t('iosStep3')] : [t('androidStep1'), t('androidStep2'), t('androidStep3')]).map((s) => h('li', {}, s)),
      ),
      h('p', { class: 'muted', style: { fontSize: '12px' } }, t('installPrivacy')),
    );
  });
}
