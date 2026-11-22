// The remaining learning science ideas, as small pure functions.

import type { KeyPoint, Keyword, Lang } from '../core/types';
import { tokenize } from '../text/tokenize';

// 6. Use, not just memorize: tasks where the learner applies an idea.
const APPLY: Record<Lang, string[]> = {
  en: [
    'Give one real example of “{k}” from your life, your work or a lab.',
    'You must explain “{k}” to a friend who missed class. What would you say in two sentences?',
    'What could go wrong if someone ignored “{k}”? Describe one situation.',
  ],
  fr: [
    'Donnez un exemple réel de « {k} » tiré de votre vie, de votre travail ou d’un labo.',
    'Expliquez « {k} » à un ami absent au cours. Que diriez-vous en deux phrases ?',
    'Que pourrait-il arriver si quelqu’un ignorait « {k} » ? Décrivez une situation.',
  ],
  ar: [
    'أعط مثالا حقيقيا واحدا على «{k}» من حياتك أو عملك أو مختبر.',
    'اشرح «{k}» لصديق غاب عن الدرس. ماذا ستقول في جملتين؟',
    'ماذا قد يحدث لو تجاهل شخص ما «{k}»؟ صف موقفا واحدا.',
  ],
};

export interface ApplyTask {
  keyword: string;
  prompt: string;
  /** A real sentence from the document about this keyword, to check against afterwards. */
  evidence: KeyPoint | null;
}

export function applyTasks(keywords: Keyword[], keyPoints: KeyPoint[], count = 3): ApplyTask[] {
  return keywords.slice(0, count).map((k, i) => {
    const templates = APPLY[k.lang] ?? APPLY.en;
    return {
      keyword: k.display,
      prompt: templates[i % templates.length].replace('{k}', k.display),
      evidence: keyPoints.find((p) => p.keywords.includes(k.display)) ?? null,
    };
  });
}

/** Did the learner's answer actually use the idea (the keyword itself)? */
export function usesKeyword(answer: string, keyword: string): boolean {
  const a = new Set(tokenize(answer).map((t) => t.stem));
  return tokenize(keyword).every((t) => a.has(t.stem));
}

// 15. Protege effect: the learner "trains" their spider by teaching it.
export interface SpiderMind {
  /** Keywords the learner has taught the spider. */
  learned: string[];
}

export function teachSpider(mind: SpiderMind, mentioned: string[]): { mind: SpiderMind; newlyLearned: string[] } {
  const known = new Set(mind.learned.map((x) => x.toLowerCase()));
  const newly = mentioned.filter((m) => !known.has(m.toLowerCase()));
  return { mind: { learned: [...mind.learned, ...newly] }, newlyLearned: newly };
}

export function spiderLevel(learned: number, total: number): { level: number; share: number } {
  const share = total ? Math.min(1, learned / total) : 0;
  return { level: 1 + Math.floor(share * 4), share };
}

// 12. Emotion helps memory: a friendly spider with short, varied reactions.
const CHEERS: Record<Lang, string[]> = {
  en: ['Nice catch!', 'You got it!', 'Sharp!', 'Web-tastic!', 'Keep going!'],
  fr: ['Bien vu !', 'Bravo !', 'Excellent !', 'Super toile !', 'Continue !'],
  ar: ['أحسنت!', 'رائع!', 'ممتاز!', 'استمر!', 'إجابة ذكية!'],
};
const COMFORT: Record<Lang, string[]> = {
  en: ['Almost! Check the page.', 'Mistakes help memory too.', 'Let’s look again.'],
  fr: ['Presque ! Regarde la page.', 'Les erreurs aident aussi.', 'On regarde encore ?'],
  ar: ['قريب! راجع الصفحة.', 'الأخطاء تساعد الذاكرة أيضا.', 'لنراجع مرة أخرى.'],
};

export function spiderLine(lang: Lang, good: boolean, n: number): string {
  const list = (good ? CHEERS : COMFORT)[lang];
  return list[n % list.length];
}
