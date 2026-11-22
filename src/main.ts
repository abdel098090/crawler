// Entry point: creates the app inside <div id="app"> and switches on each feature.
import { App } from './ui/app';
import { installCommands } from './ui/commands';
import { installStudy } from './ui/study';
import { installWordHunt } from './ui/wordhunt';

const root = document.getElementById('app');
if (root) {
  const app = new App(root);
  installCommands(app);
  installWordHunt(app);
  installStudy(app);
  app.renderPanels();
  // Handy for debugging in the browser console.
  (window as unknown as { ankabut: App }).ankabut = app;
}
