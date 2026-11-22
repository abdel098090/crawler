// Understands what the user types in the command panel, in English,
// French, Spanish or Arabic. It is simple pattern matching, not AI, so it is fast,
// private and predictable.
//
// Examples:
//   "Find every 'cloud'"            -> { type: 'find', query: 'cloud' }
//   "Take the key points from 10 to 20" -> { type: 'keypoints', from: 10, to: 20 }
//   "Explique cette section simplement" -> { type: 'explain' }
//   "ابحث عن كل «سحابة»"              -> { type: 'find', query: 'سحابة' }
//   "Suggest a name for this topic"   -> { type: 'topic' }

export type Command =
  | { type: 'find'; query: string }
  | { type: 'keypoints'; from?: number; to?: number }
  | { type: 'explain'; from?: number; to?: number }
  | { type: 'topic' }
  | { type: 'empty' };

const DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => DIGITS[d]);

/** Finds "10 to 20", "de 10 à 20", "pages 10-20", "من 10 إلى 20". */
function findRange(text: string): { from?: number; to?: number } {
  const m = /(\d+)\s*(?:to|-|–|—|à|a|hasta|jusqu'à|jusqu’à|إلى|الى|حتى)\s*(?:page\s*|p\.\s*|الصفحة\s*)?(\d+)/i.exec(text);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }
  const single = /(?:page|p\.|p[áa]gina|الصفحة|صفحة)\s*(\d+)/i.exec(text);
  if (single) return { from: Number(single[1]), to: Number(single[1]) };
  return {};
}

const FIND = /^(?:please\s+)?(?:find|search(?:\s+for)?|look\s+for|hunt|locate|cherche[rz]?|trouve[rz]?|recherche[rz]?|chercher|busca[rd]?|encuentra|localiza|ابحث\s+عن|ابحث|جد|اعثر\s+على|فتش\s+عن)\s+(?:every|all(?:\s+the)?|each|chaque|tous\s+les|toutes\s+les|tout|cada|todas\s+las|todos\s+los|كل)?\s*(?:occurrences?\s+of\s+|mentions?\s+of\s+|les\s+|le\s+|la\s+|el\s+|los\s+|las\s+)?(.+)$/i;
const KEYPOINTS = /(key\s*points?|main\s*points?|summar|points?\s+cl[ée]s|r[ée]sum|l'essentiel|puntos?\s+clave|ideas?\s+clave|resum|النقاط\s+الرئيسية|النقاط\s+المهمة|لخص|ملخص|الأفكار\s+الرئيسية)/i;
// Topic, main point (singular) and name ideas. "main points" (plural) still means key points.
const TOPIC = /(\b(?:name|title|rename|topic|subject)\b|main\s+(?:point|idea)(?!s)|what\s+is\s+(?:it|this|this\s+file)\s+about|\b(?:nom|titre|renommer|sujet|th[èe]me)\b|id[ée]e\s+principale|\b(?:nombre|t[íi]tulo|tema|renombrar)\b|idea\s+principal(?!es)|de\s+qu[ée]\s+trata|(?:^|\s)(?:ال)?(?:اسم|عنوان|موضوع)|(?:^|\s)سمّ|الفكرة\s+الرئيسية)/i;
const EXPLAIN = /(explain|simplif|in\s+simple|explique|expliquer|simplement|explica|sencill|simple|اشرح|بسط|ببساطة|وضح)/i;

function unquote(s: string): string {
  return s.trim().replace(/[.!?؟]+$/, '').replace(/^["'“”«»‘’]+|["'“”«»‘’]+$/g, '').trim();
}

export function parseCommand(input: string): Command {
  const text = toLatinDigits(input.trim());
  if (!text) return { type: 'empty' };
  // "Find every 'name'" is still a search: an explicit find verb wins.
  const f0 = FIND.exec(text);
  // A single word like "name" is a search, not a request for a name.
  if (TOPIC.test(text) && !f0 && /\s/.test(text)) return { type: 'topic' };
  if (KEYPOINTS.test(text)) return { type: 'keypoints', ...findRange(text) };
  if (EXPLAIN.test(text)) return { type: 'explain', ...findRange(text) };
  const f = FIND.exec(text);
  if (f) return { type: 'find', query: unquote(f[1]) };
  // Anything else is treated as a search, which is the most useful guess.
  return { type: 'find', query: unquote(text) };
}
