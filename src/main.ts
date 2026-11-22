// Entry point: creates the app inside <div id="app"> and switches on each feature.
import { App } from './ui/app';
import { installCommands } from './ui/commands';
import { installStudy } from './ui/study';
import { installStudyMode } from './ui/studymode';
import { installQuality } from './ui/quality';
import { installComfort } from './ui/comfort';
import { installLibrary } from './ui/library';
import { installRoadmap } from './ui/roadmap';
import { installLearning } from './ui/learning';
import { installPractice } from './ui/practice';
import { installLocalAi } from './ui/localai';
import { installWordHunt } from './ui/wordhunt';
import { installVocab } from './ui/vocab';

const root = document.getElementById('app');
if (root) {
  const app = new App(root);
  installCommands(app);
  installWordHunt(app);
  installVocab(app);
  installStudy(app);
  installStudyMode(app);
  installQuality(app);
  installComfort(app);
  installLibrary(app);
  installRoadmap(app);
  installLearning(app);
  installPractice(app);
  installLocalAi(app);
  app.renderPanels();
  // Handy for debugging in the browser console.
  (window as unknown as { ankabut: App }).ankabut = app;
}
