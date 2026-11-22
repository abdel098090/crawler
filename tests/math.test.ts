import { describe, expect, it } from 'vitest';
import { hasFormula, isMathHeavy } from '../src/text/math';

describe('formula detector', () => {
  it.each([
    'A quadratic equation is an equation of the form ax +bx+c = 0, 2 where a ̸= 0.',
    '2a If the discriminant is positive, the equation has two real solutions.',
    'The number ∆ = b2 − 4ac is called the discriminant.',
    'Here a = 1, b = −5 and c = 6.',
    'Then x = 5±1, so x = 3 or x = 2.',
    'The area of a circle is π r².',
    'F = m × a',
  ])('finds math in "%s"', (s) => {
    expect(hasFormula(s)).toBe(true);
  });
  it.each([
    'The discriminant tells us how many real solutions a quadratic equation has.',
    'PC1 and PC2 use the gateway 192.168.10.1 on switch S1.',
    'A real apology repairs trust after a conflict.',
    'Router R1 connects VLAN 10 to VLAN 20.',
    'In 2021, 45% of students used a study app.',
    'الأمن السيبراني هو حماية الأجهزة والشبكات.',
    'Use the show ip interface brief command on S2.',
  ])('leaves normal text alone: "%s"', (s) => {
    expect(hasFormula(s)).toBe(false);
  });
  it('flags a math chapter but not a networking chapter', () => {
    expect(isMathHeavy([{ text: 'Solve x2 − 5x + 6 = 0.\nHere a = 1, b = −5.\nSo ∆ = 1.\nThe end.' }])).toBe(true);
    expect(isMathHeavy([{ text: 'PC1 uses gateway 192.168.10.1.\nS1 has VLAN 1.\nPing PC3 from PC1.' }])).toBe(false);
  });
});
