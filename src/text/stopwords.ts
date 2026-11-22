// Stopwords are very common words ("the", "et", "في") that carry little meaning.
// We ignore them when picking keywords. Arabic words are stored already normalized.

import { normalizeArabic } from './arabic';

const EN = `a about above after again against all almost also although always am an and another any anyone anything are
around as at back be became because become been before being below between both but by can cannot could did do does
doing done down during each either else enough even ever every few first for from further get gets getting give given
go goes going got had has have having he her here hers herself him himself his how however i if in into is it its itself
just keep last less let like made make makes many may me might more most much must my myself near need neither never new
next no nor not now of off often on once one only onto or other others otherwise our ours ourselves out over own per
perhaps put rather really same see seem seemed seems several shall she should since so some something sometimes still
such take than that the their theirs them themselves then there therefore these they thing things this those though
through thus to together too toward towards two under until up upon us use used uses using very via was we well were
what whatever when where whether which while who whom whose why will with within without would yet you your yours
yourself yourselves s t don can't won't isn't aren't it's that's there's i'm you're we're they're let's e.g i.e etc`;

const FR = `a à afin ai aie aient aies ait alors as au aucun aucune auquel aussi autre autres aux auxquelles auxquels avaient
avais avait avant avec avez aviez avions avoir avons ayant c ça car ce ceci cela celle celles celui cependant certain
certaine certaines certains ces cet cette ceux chacun chacune chaque chez ci comme comment d dans de des desquelles
desquels dessous dessus deux devant doit donc dont du duquel durant elle elles en encore entre es est et étaient
étais était étant été être eu eux fait faire fois font hors i il ils j je jusqu jusque l la là laquelle le lequel les
lesquelles lesquels leur leurs lors lorsque lui m ma mais me même mêmes mes moi moins mon n ne ni non nos notre nous
on ont ou où par parce parmi pas pendant peu peut peuvent plus plusieurs pour pourquoi pourrait puis qu quand que
quel quelle quelles quels qui quoi s sa sans se selon ses si sien soi soit sommes son sont sous souvent suis sur t ta
tandis te tel telle telles tels tes toi ton tous tout toute toutes très tu un une unes uns vers via voici voilà vos
votre vous y aussi ainsi également afin donc toutefois cependant d'un d'une qu'il qu'elle c'est n'est l'on`;

const AR = `في من على إلى الى عن مع هذا هذه ذلك تلك هو هي هم هن أنا انا نحن أنت انت أنتم كان كانت يكون تكون كانوا
ثم أو او أم ام بل لا لم لن ما ماذا متى أين اين كيف لماذا هل قد كل بعض غير بين عند حتى إذا اذا إن ان أن لكن لكي كي
التي الذي الذين اللذين اللتين اللواتي اللاتي و ف ب ل ك يا أي اي أيضا ايضا جدا فقط حيث حين بعد قبل فوق تحت خلال
عليه عليها فيه فيها منه منها إليه اليه به بها له لها لهم هناك هنا كما مثل وقد فقد ولا وما ومن وفي وهو وهي وكان
وكانت ليس ليست سوف أكثر اكثر أقل اقل إلا الا ذات ذو أول اول كذلك عندما بينما لدى منذ نحو ضمن عبر دون سوى تم يتم
يستخدم تستخدم استخدم استخدمت يقوم تقوم قام قامت يمكن تمكن يجب ينبغي يكون أصبح اصبح يعد تعد يعني تعني فيستخدم ويستخدم جميع معظم أحد احد عام خاصة خاص`;

const ES = `a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque cada como con contra cual cuales
cuando cuanto de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba
estado estan estar estas este esto estos fue fueron ha haber habia han hasta hay la las le les lo los mas me mi mis mismo
mucho muy nada ni no nos nosotros o otra otras otro otros para pero poco por porque puede pueden que quien quienes se
sea ser si sido sin sobre son su sus tambien tan tanto te tiene tienen todo todos tu tus un una unas uno unos usted
ustedes y ya yo cuya cuyo durante segun tras mientras entonces ademas sino siempre solo sus vez veces asi`;

function build(list: string, normalize: (w: string) => string): Set<string> {
  return new Set(
    list
      .split(/\s+/)
      .map((w) => normalize(w.trim()))
      .filter(Boolean),
  );
}

const latinNorm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const STOPWORDS = {
  en: build(EN, latinNorm),
  fr: build(FR, latinNorm),
  ar: build(AR, normalizeArabic),
  es: build(ES, latinNorm),
};

/** True when a normalized token is a stopword in any of the four languages. */
export function isStopword(normalizedToken: string): boolean {
  return STOPWORDS.en.has(normalizedToken) || STOPWORDS.fr.has(normalizedToken) || STOPWORDS.ar.has(normalizedToken) || STOPWORDS.es.has(normalizedToken);
}

export { latinNorm };
