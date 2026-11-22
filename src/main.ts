// Entry point: creates the app inside <div id="app">.
import { App } from './ui/app';

const root = document.getElementById('app');
if (root) {
  const app = new App(root);
  // Handy for debugging in the browser console.
  (window as unknown as { ankabut: App }).ankabut = app;
}
