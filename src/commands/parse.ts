// Understands what the user types in the command panel, in English,
// French or Arabic. It is simple pattern matching, not AI, so it is fast,
// private and predictable.
//
// Examples:
//   "Find every 'cloud'"            -> { type: 'find', query: 'cloud' }
//   "Take the key points from 10 to 20" -> { type: 'keypoints', from: 10, to: 20 }
//   "Explique cette section simplement" -> { type: 'explain' }
//   "ابحث عن كل «سحابة»"              -> { type: 'find', query: 'سحابة' }

export type Command =
  | { type: 'find'; query: string }
  | { type: 'keypoints'; from?: number; to?: number }
  | { type: 'explain'; from?: number; to?: number }
  | { type: 'empty' };

const DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => DIGITS[d]);

/** Finds "10 to 20", "de 10 à 20", "pages 10-20", "من 10 إلى 20". */
function findRange(text: string): { from?: number; to?: number } {
  const m = /(\d+)\s*(?:to|-|–|—|à|a|jusqu'à|jusqu’à|إلى|الى|حتى)\s*(?:page\s*|p\.\s*|الصفحة\s*)?(\d+)/i.exec(text);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }
  const single = /(?:page|p\.|الصفحة|صفحة)\s*(\d+)/i.exec(text);
  if (single) return { from: Number(single[1]), to: Number(single[1]) };
  return {};
}

const FIND = /^(?:please\s+)?(?:find|search(?:\s+for)?|look\s+for|hunt|locate|cherche[rz]?|trouve[rz]?|recherche[rz]?|chercher|ابحث\s+عن|ابحث|جد|اعثر\s+على|فتش\s+عن)\s+(?:every|all(?:\s+the)?|each|chaque|tous\s+les|toutes\s+les|tout|كل)?\s*(?:occurrences?\s+of\s+|mentions?\s+of\s+|les\s+|le\s+|la\s+)?(.+)$/i;
const KEYPOINTS = /(key\s*points?|main\s*points?|summar|points?\s+cl[ée]s|r[ée]sum|l'essentiel|النقاط\s+الرئيسية|النقاط\s+المهمة|لخص|ملخص|الأفكار\s+الرئيسية)/i;
const EXPLAIN = /(explain|simplif|in\s+simple|explique|expliquer|simplement|اشرح|بسط|ببساطة|وضح)/i;

function unquote(s: string): string {
  return s.trim().replace(/[.!?؟]+$/, '').replace(/^["'“”«»‘’]+|["'“”«»‘’]+$/g, '').trim();
}

export function parseCommand(input: string): Command {
  const text = toLatinDigits(input.trim());
  if (!text) return { type: 'empty' };
  if (KEYPOINTS.test(text)) return { type: 'keypoints', ...findRange(text) };
  if (EXPLAIN.test(text)) return { type: 'explain', ...findRange(text) };
  const f = FIND.exec(text);
  if (f) return { type: 'find', query: unquote(f[1]) };
  // Anything else is treated as a search, which is the most useful guess.
  return { type: 'find', query: unquote(text) };
}
