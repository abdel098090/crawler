// A small offline trilingual dictionary (English, French, Arabic) of study and
// cybersecurity terms. Used by "translate on tap" when the browser has no
// built-in on-device translator. Entries: [en, fr, ar].

import { normalizeArabic, stemArabic } from '../text/arabic';
import { latinNorm } from '../text/stopwords';
import type { Lang } from '../core/types';

const ENTRIES: [string, string, string][] = [
  ['security', 'sécurité', 'أمن'], ['network', 'réseau', 'شبكة'], ['firewall', 'pare-feu', 'جدار ناري'],
  ['encryption', 'chiffrement', 'تشفير'], ['key', 'clé', 'مفتاح'], ['password', 'mot de passe', 'كلمة المرور'],
  ['attack', 'attaque', 'هجوم'], ['attacker', 'attaquant', 'مهاجم'], ['vulnerability', 'vulnérabilité', 'ثغرة'],
  ['threat', 'menace', 'تهديد'], ['risk', 'risque', 'خطر'], ['malware', 'logiciel malveillant', 'برمجية خبيثة'],
  ['virus', 'virus', 'فيروس'], ['phishing', 'hameçonnage', 'تصيد احتيالي'], ['server', 'serveur', 'خادم'],
  ['client', 'client', 'عميل'], ['browser', 'navigateur', 'متصفح'], ['certificate', 'certificat', 'شهادة'],
  ['protocol', 'protocole', 'بروتوكول'], ['packet', 'paquet', 'حزمة'], ['port', 'port', 'منفذ'],
  ['router', 'routeur', 'موجه'], ['traffic', 'trafic', 'حركة المرور'], ['data', 'données', 'بيانات'],
  ['information', 'information', 'معلومات'], ['user', 'utilisateur', 'مستخدم'], ['account', 'compte', 'حساب'],
  ['authentication', 'authentification', 'مصادقة'], ['authorization', 'autorisation', 'تفويض'], ['access', 'accès', 'وصول'],
  ['privacy', 'vie privée', 'خصوصية'], ['rule', 'règle', 'قاعدة'], ['policy', 'politique', 'سياسة'],
  ['system', 'système', 'نظام'], ['software', 'logiciel', 'برمجيات'], ['hardware', 'matériel', 'عتاد'],
  ['computer', 'ordinateur', 'حاسوب'], ['device', 'appareil', 'جهاز'], ['file', 'fichier', 'ملف'],
  ['code', 'code', 'شيفرة'], ['program', 'programme', 'برنامج'], ['update', 'mise à jour', 'تحديث'],
  ['patch', 'correctif', 'رقعة'], ['backup', 'sauvegarde', 'نسخة احتياطية'], ['database', 'base de données', 'قاعدة بيانات'],
  ['query', 'requête', 'استعلام'], ['injection', 'injection', 'حقن'], ['exploit', 'exploit', 'استغلال'],
  ['scan', 'scan', 'فحص'], ['wireless', 'sans fil', 'لاسلكي'], ['cloud', 'nuage', 'سحابة'],
  ['internet', 'internet', 'الإنترنت'], ['website', 'site web', 'موقع ويب'], ['email', 'courriel', 'بريد إلكتروني'],
  ['message', 'message', 'رسالة'], ['identity', 'identité', 'هوية'], ['token', 'jeton', 'رمز'],
  ['session', 'session', 'جلسة'], ['log', 'journal', 'سجل'], ['alert', 'alerte', 'تنبيه'],
  ['incident', 'incident', 'حادث'], ['response', 'réponse', 'استجابة'], ['defense', 'défense', 'دفاع'],
  ['protection', 'protection', 'حماية'], ['protect', 'protéger', 'يحمي'], ['secure', 'sécurisé', 'آمن'],
  ['public', 'public', 'عام'], ['private', 'privé', 'خاص'], ['symmetric', 'symétrique', 'متماثل'],
  ['hash', 'hachage', 'تجزئة'], ['signature', 'signature', 'توقيع'], ['trust', 'confiance', 'ثقة'],
  ['connection', 'connexion', 'اتصال'], ['address', 'adresse', 'عنوان'], ['domain', 'domaine', 'نطاق'],
  ['book', 'livre', 'كتاب'], ['page', 'page', 'صفحة'], ['chapter', 'chapitre', 'فصل'],
  ['library', 'bibliothèque', 'مكتبة'], ['student', 'étudiant', 'طالب'], ['teacher', 'enseignant', 'معلم'],
  ['lesson', 'leçon', 'درس'], ['question', 'question', 'سؤال'], ['answer', 'réponse', 'جواب'],
  ['example', 'exemple', 'مثال'], ['summary', 'résumé', 'ملخص'], ['definition', 'définition', 'تعريف'],
  ['knowledge', 'connaissance', 'معرفة'], ['learning', 'apprentissage', 'تعلم'], ['memory', 'mémoire', 'ذاكرة'],
  ['test', 'test', 'اختبار'], ['exam', 'examen', 'امتحان'], ['study', 'étude', 'دراسة'],
  ['right', 'droit', 'حق'], ['law', 'loi', 'قانون'], ['human rights', 'droits humains', 'حقوق الإنسان'],
  ['freedom', 'liberté', 'حرية'], ['research', 'recherche', 'بحث'], ['method', 'méthode', 'طريقة'],
  ['problem', 'problème', 'مشكلة'], ['solution', 'solution', 'حل'], ['training', 'formation', 'تدريب'],
  ['team', 'équipe', 'فريق'], ['organization', 'organisation', 'منظمة'], ['office', 'bureau', 'مكتب'],
  ['warning', 'avertissement', 'تحذير'], ['day', 'jour', 'يوم'], ['year', 'année', 'عام'], ['time', 'temps', 'وقت'],
];

type Index = Map<string, [string, string, string]>;
let index: Index | null = null;

function keyOf(word: string): string {
  if (/[؀-ۿ]/.test(word)) {
    const n = normalizeArabic(word).replace(/[^ء-ي ]/g, '');
    return 'ar:' + n.split(' ').map(stemArabic).join(' ');
  }
  let n = latinNorm(word).trim();
  if (n.length > 4 && n.endsWith('s') && !n.endsWith('ss')) n = n.slice(0, -1);
  return 'la:' + n;
}

function build(): Index {
  const m: Index = new Map();
  for (const e of ENTRIES) for (const w of e) if (!m.has(keyOf(w))) m.set(keyOf(w), e);
  return m;
}

/** Returns the word in all three languages, or null when it is not in the dictionary. */
export function lookup(word: string): Record<Lang, string> | null {
  index ??= build();
  const e = index.get(keyOf(word));
  return e ? { en: e[0], fr: e[1], ar: e[2] } : null;
}
