// Practice problems with new numbers every time.
//
// The answer is CALCULATED by this code, never guessed and never taken from
// broken PDF text, so it is always right. After answering, the student sees
// the worked steps. Topics: quadratic equations, linear equations,
// percentages, binary numbers and IPv4 subnetting.

import type { Lang } from '../core/types';
import { makeRng } from './rng';

export type PracticeTopic = 'quadratic' | 'linear' | 'percent' | 'binary' | 'subnet';
export const PRACTICE_TOPICS: PracticeTopic[] = ['quadratic', 'linear', 'percent', 'binary', 'subnet'];

export interface Problem {
  id: string;
  topic: PracticeTopic;
  prompt: string;
  /** The right answer, as shown to the student. */
  answer: string;
  /** The worked solution, step by step. */
  steps: string[];
  /** Kind of answer, used to check what the student typed. */
  check: { kind: 'numbers'; values: number[] } | { kind: 'text'; value: string } | { kind: 'bits'; value: string };
}

// ---------------------------------------------------------------- wording
const W: Record<Lang, Record<string, string>> = {
  en: {
    add: 'Add {b} to both sides: {lhs} = {rhs}', solve: 'Solve: {eq}', linear: 'Solve for x: {eq}', pctOf: 'What is {p}% of {n}?', pctWhat: '{x} is what percent of {y}?',
    toBin: 'Write {d} in binary (8 bits).', toDec: 'Write the binary number {b} in decimal.',
    net: 'What is the network address of {ip}/{p}?', bc: 'What is the broadcast address of {ip}/{p}?',
    hosts: 'How many usable host addresses are in a /{p} network?', mask: 'What is the subnet mask for /{p}?',
    coef: 'a = {a}, b = {b}, c = {c}', disc: 'Discriminant: Δ = b² − 4ac = {d}', root: '√Δ = {r}', formula: 'x = (−b ± √Δ) / (2a) = ({nb} ± {r}) / {ta}',
    sols: 'x = {x1} or x = {x2}', sub: 'Subtract {b} from both sides: {lhs} = {rhs}', div: 'Divide both sides by {a}: x = {x}',
    pct1: '{p}% = {p} / 100', pct2: '{p} / 100 × {n} = {r}', pct3: '{x} / {y} = {f}', pct4: '{f} × 100 = {p}%',
    bits: 'Place values: 128 64 32 16 8 4 2 1', used: 'Add the place values with a 1: {sum} = {d}', take: 'Take the biggest place values that fit: {sum} = {d}',
    prefix: '/{p} means {p} network bits and {h} host bits', block: 'Block size in octet {o}: 256 − {m} = {bs}', netStep: '{v} is in the block that starts at {n}', bcStep: 'Broadcast = next block − 1 = {b}',
    hostStep: 'Usable hosts = 2^{h} − 2 = {n}', maskStep: '{p} ones then zeros: {mask}', or: 'or',
  },
  fr: {
    add: 'Ajoute {b} des deux côtés : {lhs} = {rhs}', solve: 'Résous : {eq}', linear: 'Résous pour x : {eq}', pctOf: 'Combien font {p} % de {n} ?', pctWhat: '{x} représente quel pourcentage de {y} ?',
    toBin: 'Écris {d} en binaire (8 bits).', toDec: 'Écris le nombre binaire {b} en décimal.',
    net: 'Quelle est l’adresse réseau de {ip}/{p} ?', bc: 'Quelle est l’adresse de diffusion de {ip}/{p} ?',
    hosts: 'Combien d’adresses d’hôtes utilisables dans un réseau /{p} ?', mask: 'Quel est le masque de sous-réseau pour /{p} ?',
    coef: 'a = {a}, b = {b}, c = {c}', disc: 'Discriminant : Δ = b² − 4ac = {d}', root: '√Δ = {r}', formula: 'x = (−b ± √Δ) / (2a) = ({nb} ± {r}) / {ta}',
    sols: 'x = {x1} ou x = {x2}', sub: 'Soustrais {b} des deux côtés : {lhs} = {rhs}', div: 'Divise les deux côtés par {a} : x = {x}',
    pct1: '{p} % = {p} / 100', pct2: '{p} / 100 × {n} = {r}', pct3: '{x} / {y} = {f}', pct4: '{f} × 100 = {p} %',
    bits: 'Valeurs des positions : 128 64 32 16 8 4 2 1', used: 'Additionne les positions à 1 : {sum} = {d}', take: 'Prends les plus grandes positions qui tiennent : {sum} = {d}',
    prefix: '/{p} veut dire {p} bits réseau et {h} bits hôte', block: 'Taille du bloc dans l’octet {o} : 256 − {m} = {bs}', netStep: '{v} est dans le bloc qui commence à {n}', bcStep: 'Diffusion = bloc suivant − 1 = {b}',
    hostStep: 'Hôtes utilisables = 2^{h} − 2 = {n}', maskStep: '{p} uns puis des zéros : {mask}', or: 'ou',
  },
  es: {
    add: 'Suma {b} en los dos lados: {lhs} = {rhs}', solve: 'Resuelve: {eq}', linear: 'Despeja x: {eq}', pctOf: '¿Cuánto es el {p} % de {n}?', pctWhat: '¿Qué porcentaje de {y} es {x}?',
    toBin: 'Escribe {d} en binario (8 bits).', toDec: 'Escribe el número binario {b} en decimal.',
    net: '¿Cuál es la dirección de red de {ip}/{p}?', bc: '¿Cuál es la dirección de broadcast de {ip}/{p}?',
    hosts: '¿Cuántas direcciones de host utilizables hay en una red /{p}?', mask: '¿Cuál es la máscara de subred para /{p}?',
    coef: 'a = {a}, b = {b}, c = {c}', disc: 'Discriminante: Δ = b² − 4ac = {d}', root: '√Δ = {r}', formula: 'x = (−b ± √Δ) / (2a) = ({nb} ± {r}) / {ta}',
    sols: 'x = {x1} o x = {x2}', sub: 'Resta {b} en los dos lados: {lhs} = {rhs}', div: 'Divide los dos lados entre {a}: x = {x}',
    pct1: '{p} % = {p} / 100', pct2: '{p} / 100 × {n} = {r}', pct3: '{x} / {y} = {f}', pct4: '{f} × 100 = {p} %',
    bits: 'Valores de posición: 128 64 32 16 8 4 2 1', used: 'Suma las posiciones con 1: {sum} = {d}', take: 'Toma las posiciones más grandes que caben: {sum} = {d}',
    prefix: '/{p} significa {p} bits de red y {h} bits de host', block: 'Tamaño del bloque en el octeto {o}: 256 − {m} = {bs}', netStep: '{v} está en el bloque que empieza en {n}', bcStep: 'Broadcast = bloque siguiente − 1 = {b}',
    hostStep: 'Hosts utilizables = 2^{h} − 2 = {n}', maskStep: '{p} unos y luego ceros: {mask}', or: 'o',
  },
  ar: {
    add: 'أضف {b} إلى الطرفين: {lhs} = {rhs}', solve: 'حلّ المعادلة: {eq}', linear: 'أوجد قيمة x: {eq}', pctOf: 'كم يساوي {p}% من {n}؟', pctWhat: '{x} تمثل كم بالمئة من {y}؟',
    toBin: 'اكتب العدد {d} بالنظام الثنائي (8 بت).', toDec: 'اكتب العدد الثنائي {b} بالنظام العشري.',
    net: 'ما هو عنوان الشبكة لـ {ip}/{p}؟', bc: 'ما هو عنوان البث لـ {ip}/{p}؟',
    hosts: 'كم عدد عناوين الأجهزة القابلة للاستخدام في شبكة /{p}؟', mask: 'ما هو قناع الشبكة الفرعية لـ /{p}؟',
    coef: 'a = {a}، b = {b}، c = {c}', disc: 'المميّز: Δ = b² − 4ac = {d}', root: '√Δ = {r}', formula: 'x = (−b ± √Δ) / (2a) = ({nb} ± {r}) / {ta}',
    sols: 'x = {x1} أو x = {x2}', sub: 'اطرح {b} من الطرفين: {lhs} = {rhs}', div: 'اقسم الطرفين على {a}: x = {x}',
    pct1: '{p}% = {p} / 100', pct2: '{p} / 100 × {n} = {r}', pct3: '{x} / {y} = {f}', pct4: '{f} × 100 = {p}%',
    bits: 'قيم الخانات: 128 64 32 16 8 4 2 1', used: 'اجمع قيم الخانات التي فيها 1: {sum} = {d}', take: 'خذ أكبر القيم التي تتسع: {sum} = {d}',
    prefix: '/{p} تعني {p} بت للشبكة و{h} بت للأجهزة', block: 'حجم الكتلة في الثُمانية {o}: 256 − {m} = {bs}', netStep: '{v} تقع في الكتلة التي تبدأ عند {n}', bcStep: 'عنوان البث = الكتلة التالية − 1 = {b}',
    hostStep: 'الأجهزة القابلة للاستخدام = 2^{h} − 2 = {n}', maskStep: '{p} من الآحاد ثم أصفار: {mask}', or: 'أو',
  },
};

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
/** Minus sign as printed in books. */
const num = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** "2x² − 3x − 2 = 0" from a, b, c. */
export function formatQuadratic(a: number, b: number, c: number): string {
  const term = (k: number, v: string, first: boolean) => {
    if (k === 0) return '';
    const sign = k < 0 ? (first ? '−' : ' − ') : first ? '' : ' + ';
    const abs = Math.abs(k);
    return `${sign}${abs === 1 && v ? '' : abs}${v}`;
  };
  return `${term(a, 'x²', true)}${term(b, 'x', false)}${term(c, '', false)} = 0`;
}

// ---------------------------------------------------------------- generators
function int(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function quadratic(rng: () => number, lang: Lang): Problem {
  const w = W[lang];
  let r1 = int(rng, -9, 9);
  let r2 = int(rng, -9, 9);
  while (r2 === r1) r2 = int(rng, -9, 9);
  if (r1 < r2) [r1, r2] = [r2, r1];
  const a = [1, 1, 1, 2, 3][int(rng, 0, 4)];
  const b = -a * (r1 + r2);
  const c = a * r1 * r2;
  const disc = b * b - 4 * a * c;
  const root = Math.round(Math.sqrt(disc));
  return {
    id: `q:${a}:${b}:${c}`,
    topic: 'quadratic',
    prompt: fill(w.solve, { eq: formatQuadratic(a, b, c) }),
    answer: fill(w.sols, { x1: num(r1), x2: num(r2) }),
    steps: [
      fill(w.coef, { a: num(a), b: num(b), c: num(c) }),
      // A negative b needs brackets: (−6)² is 36, but −6² would mean −36.
      fill(w.disc, { d: `${b < 0 ? `(${num(b)})` : num(b)}² − 4 × ${num(a)} × ${c < 0 ? `(${num(c)})` : num(c)} = ${disc}` }),
      fill(w.root, { r: root }),
      fill(w.formula, { nb: num(-b), r: root, ta: 2 * a }),
      fill(w.sols, { x1: num(r1), x2: num(r2) }),
    ],
    check: { kind: 'numbers', values: [r1, r2] },
  };
}

function linear(rng: () => number, lang: Lang): Problem {
  const w = W[lang];
  const a = int(rng, 2, 9);
  const x = int(rng, -10, 10);
  let b = int(rng, -20, 20);
  if (b === 0) b = 7;
  const c = a * x + b;
  const eq = `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${num(c)}`;
  return {
    id: `l:${a}:${b}:${c}`,
    topic: 'linear',
    prompt: fill(w.linear, { eq }),
    answer: `x = ${num(x)}`,
    steps: [fill(b < 0 ? w.add : w.sub, { b: Math.abs(b), lhs: `${a}x`, rhs: num(c - b) }), fill(w.div, { a, x: num(x) })],
    check: { kind: 'numbers', values: [x] },
  };
}

function percent(rng: () => number, lang: Lang): Problem {
  const w = W[lang];
  const p = [5, 10, 15, 20, 25, 30, 40, 50, 75][int(rng, 0, 8)];
  const n = 20 * int(rng, 1, 20);
  const r = (p * n) / 100;
  if (rng() < 0.5) {
    return {
      id: `p1:${p}:${n}`,
      topic: 'percent',
      prompt: fill(w.pctOf, { p, n }),
      answer: String(r),
      steps: [fill(w.pct1, { p }), fill(w.pct2, { p, n, r })],
      check: { kind: 'numbers', values: [r] },
    };
  }
  return {
    id: `p2:${r}:${n}`,
    topic: 'percent',
    prompt: fill(w.pctWhat, { x: r, y: n }),
    answer: `${p}%`,
    steps: [fill(w.pct3, { x: r, y: n, f: p / 100 }), fill(w.pct4, { f: p / 100, p })],
    check: { kind: 'numbers', values: [p] },
  };
}

const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];
export const toBits = (d: number) => d.toString(2).padStart(8, '0');

function binary(rng: () => number, lang: Lang): Problem {
  const w = W[lang];
  const d = int(rng, 1, 255);
  const bits = toBits(d);
  const sum = PLACES.filter((_, i) => bits[i] === '1').join(' + ');
  if (rng() < 0.5) {
    return { id: `b1:${d}`, topic: 'binary', prompt: fill(w.toBin, { d }), answer: bits, steps: [fill(w.bits, {}), fill(w.take, { sum, d })], check: { kind: 'bits', value: bits } };
  }
  return { id: `b2:${d}`, topic: 'binary', prompt: fill(w.toDec, { b: bits }), answer: String(d), steps: [fill(w.bits, {}), fill(w.used, { sum, d })], check: { kind: 'numbers', values: [d] } };
}

export function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
}
export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
}
export function maskOf(prefix: number): string {
  return intToIp(prefix === 0 ? 0 : 2 ** 32 - 2 ** (32 - prefix));
}
export function subnet(ip: string, prefix: number): { network: string; broadcast: string; hosts: number; mask: string } {
  const size = 2 ** (32 - prefix);
  const net = Math.floor(ipToInt(ip) / size) * size;
  return { network: intToIp(net), broadcast: intToIp(net + size - 1), hosts: Math.max(0, size - 2), mask: maskOf(prefix) };
}

function subnetProblem(rng: () => number, lang: Lang): Problem {
  const w = W[lang];
  const p = int(rng, 20, 30);
  const base = [[192, 168, int(rng, 0, 255)], [10, int(rng, 0, 255), int(rng, 0, 255)], [172, int(rng, 16, 31), int(rng, 0, 255)]][int(rng, 0, 2)];
  const ip = [...base, int(rng, 1, 254)].join('.');
  const s = subnet(ip, p);
  const h = 32 - p;
  const octet = Math.min(4, Math.floor(p / 8) + 1); // the octet where the mask is not 255 or 0
  const m = Number(s.mask.split('.')[octet - 1]);
  const bs = 256 - m;
  const v = Number(ip.split('.')[octet - 1]);
  const start = Math.floor(v / bs) * bs;
  const common = [fill(w.prefix, { p, h }), fill(w.maskStep, { p, mask: s.mask })];
  const blockSteps = [fill(w.block, { o: octet, m, bs }), fill(w.netStep, { v, n: start })];
  const kind = int(rng, 0, 3);
  if (kind === 0) return { id: `s0:${ip}/${p}`, topic: 'subnet', prompt: fill(w.net, { ip, p }), answer: s.network, steps: [...common, ...blockSteps, s.network], check: { kind: 'text', value: s.network } };
  if (kind === 1) return { id: `s1:${ip}/${p}`, topic: 'subnet', prompt: fill(w.bc, { ip, p }), answer: s.broadcast, steps: [...common, ...blockSteps, fill(w.bcStep, { b: s.broadcast })], check: { kind: 'text', value: s.broadcast } };
  if (kind === 2) return { id: `s2:${p}`, topic: 'subnet', prompt: fill(w.hosts, { p }), answer: String(s.hosts), steps: [fill(w.prefix, { p, h }), fill(w.hostStep, { h, n: s.hosts })], check: { kind: 'numbers', values: [s.hosts] } };
  return { id: `s3:${p}`, topic: 'subnet', prompt: fill(w.mask, { p }), answer: s.mask, steps: common, check: { kind: 'text', value: s.mask } };
}

const MAKERS: Record<PracticeTopic, (rng: () => number, lang: Lang) => Problem> = {
  quadratic,
  linear,
  percent,
  binary,
  subnet: subnetProblem,
};

export function makeProblem(topic: PracticeTopic, lang: Lang, seed = Date.now()): Problem {
  return MAKERS[topic](makeRng(seed), lang);
}

// ---------------------------------------------------------------- checking
/** All numbers in what the student typed: "x = 3 or x = −2" -> [3, -2]. Commas between numbers are separators. */
export function numbersIn(text: string): number[] {
  return (text.replace(/[−–—]/g, '-').replace(/(\d),(\d)/g, '$1.$2').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

export function isRight(p: Problem, given: string): boolean {
  const g = given.trim();
  if (!g) return false;
  if (p.check.kind === 'bits') return g.replace(/\s+/g, '').padStart(8, '0') === p.check.value;
  if (p.check.kind === 'text') return g.replace(/\s+/g, '') === p.check.value;
  const got = numbersIn(g).sort((a, b) => a - b);
  const want = [...p.check.values].sort((a, b) => a - b);
  return got.length === want.length && got.every((n, i) => Math.abs(n - want[i]) < 1e-9);
}

// ---------------------------------------------------------------- matching the book
const HINTS: Record<PracticeTopic, RegExp> = {
  quadratic: /quadrati|discrimin|second degr|segundo grado|second-degree|تربيعي|المميز/i,
  linear: /linear equation|équation du premier|ecuación lineal|first degree|معادلة خطية|equation/i,
  percent: /percent|pourcent|porcentaje|porcentual|%|نسبة مئوية|بالمئة/i,
  binary: /binary|binaire|binario|bits?\b|ثنائي/i,
  subnet: /subnet|sous-réseau|subred|ipv4|cidr|prefix|netmask|mask|شبكة فرعية|قناع/i,
};

/** Topics that match the words of the current document, best first. */
export function suggestTopics(text: string): PracticeTopic[] {
  return PRACTICE_TOPICS.filter((t) => HINTS[t].test(text));
}
