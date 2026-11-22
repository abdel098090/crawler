import { describe, expect, it } from 'vitest';
import { detectLang } from '../src/text/lang';
import { isStopword } from '../src/text/stopwords';
import { nameIdeas, joinList, toFileName } from '../src/analysis/topic';
import { frameSentence, definitionSubject } from '../src/analysis/explain';
import { parseCommand } from '../src/commands/parse';
import { lookup } from '../src/translate/dictionary';
import { allKeysPresent } from '../src/ui/i18n';

describe('Spanish', () => {
  it('is detected and not mixed up with French or English', () => {
    expect(detectLang('La seguridad de la red es muy importante para las empresas y los estudiantes.')).toBe('es');
    expect(detectLang('¿Qué es una contraseña segura? Es una clave larga que nadie puede adivinar.')).toBe('es');
    expect(detectLang('La sécurité du réseau est très importante pour les entreprises.')).toBe('fr');
    expect(detectLang('Network security is very important for companies and students.')).toBe('en');
  });
  it('ignores common Spanish words as keywords', () => {
    expect(isStopword('para')).toBe(true);
    expect(isStopword('tambien')).toBe(true);
    expect(isStopword('contrasena')).toBe(false);
  });
  it('makes Spanish names, lists and explanations', () => {
    expect(nameIdeas(['seguridad', 'red'], 'es')[0]).toBe('Seguridad y Red');
    expect(nameIdeas(['seguridad'], 'es')).toContain('Introducción a Seguridad');
    expect(joinList(['A', 'B', 'C'], 'es')).toBe('A, B y C');
    expect(toFileName('Introducción a la Red')).toBe('introduccion-a-la-red');
    expect(frameSentence('es', 2, 2, ['nube', 'datos'])).toBe('En palabras sencillas, la página 2 trata sobre todo de nube y datos.');
    expect(definitionSubject('El cifrado es una forma de proteger los datos.', 'es')).toBe('cifrado');
  });
  it('understands Spanish commands', () => {
    expect(parseCommand('Busca cada «nube»')).toEqual({ type: 'find', query: 'nube' });
    expect(parseCommand('Saca los puntos clave de 10 a 20')).toEqual({ type: 'keypoints', from: 10, to: 20 });
    expect(parseCommand('Explica esta sección de forma sencilla')).toEqual({ type: 'explain' });
    expect(parseCommand('Sugiere un nombre para este tema')).toEqual({ type: 'topic' });
    expect(parseCommand('¿Cuál es la idea principal?')).toEqual({ type: 'topic' });
  });
  it('translates on tap to and from Spanish', () => {
    expect(lookup('password')?.es).toBe('contraseña');
    expect(lookup('contraseña')?.en).toBe('password');
    expect(lookup('nube')?.ar).toBe('سحابة');
  });
  it('has every interface text in Spanish', () => {
    expect(allKeysPresent()).toEqual([]);
  });
});
