import { describe, expect, it } from 'vitest';
import { formatQuadratic, isRight, makeProblem, numbersIn, PRACTICE_TOPICS, subnet, suggestTopics, toBits } from '../src/study/practice';

describe('practice problems', () => {
  it('formats equations like a book', () => {
    expect(formatQuadratic(1, -5, 6)).toBe('x² − 5x + 6 = 0');
    expect(formatQuadratic(2, 3, -2)).toBe('2x² + 3x − 2 = 0');
    expect(formatQuadratic(1, 0, -9)).toBe('x² − 9 = 0');
  });

  it('subnetting is correct (checked against known answers)', () => {
    expect(subnet('192.168.10.77', 26)).toEqual({ network: '192.168.10.64', broadcast: '192.168.10.127', hosts: 62, mask: '255.255.255.192' });
    expect(subnet('172.16.5.200', 20)).toEqual({ network: '172.16.0.0', broadcast: '172.16.15.255', hosts: 4094, mask: '255.255.240.0' });
    expect(subnet('10.1.1.1', 30)).toEqual({ network: '10.1.1.0', broadcast: '10.1.1.3', hosts: 2, mask: '255.255.255.252' });
    expect(subnet('192.168.1.5', 24).broadcast).toBe('192.168.1.255');
  });

  it('every generated answer is really right, for 500 random problems per topic', () => {
    for (const topic of PRACTICE_TOPICS) {
      for (let seed = 1; seed <= 500; seed++) {
        const p = makeProblem(topic, 'en', seed);
        expect(isRight(p, p.answer), `${p.prompt} -> ${p.answer}`).toBe(true);
        if (topic === 'quadratic') {
          // Put each root back into the equation: it must give 0.
          const [, a, b, c] = p.id.split(':').map(Number);
          for (const x of p.check.kind === 'numbers' ? p.check.values : []) expect(a * x * x + b * x + c).toBe(0);
        }
        if (topic === 'linear') {
          const [, a, b, c] = p.id.split(':').map(Number);
          const x = p.check.kind === 'numbers' ? p.check.values[0] : NaN;
          expect(a * x + b).toBe(c);
        }
        expect(p.steps.length).toBeGreaterThan(0);
      }
    }
  });

  it('accepts the answer written in different ways', () => {
    const q = makeProblem('quadratic', 'en', 7);
    const [r1, r2] = q.check.kind === 'numbers' ? q.check.values : [0, 0];
    expect(isRight(q, `x = ${r2} or x = ${r1}`)).toBe(true);
    expect(isRight(q, `${r1}, ${r2}`)).toBe(true);
    expect(isRight(q, `${r1}`)).toBe(false);
    expect(numbersIn('x = −3 or x = 2')).toEqual([-3, 2]);
    expect(numbersIn('12,5')).toEqual([12.5]);
    const b = makeProblem('binary', 'en', 3);
    if (b.check.kind === 'bits') expect(isRight(b, b.answer.replace(/^0+/, ''))).toBe(true);
    expect(toBits(5)).toBe('00000101');
    expect(isRight(makeProblem('linear', 'en', 1), '')).toBe(false);
  });

  it('puts brackets around negative numbers in the steps', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = makeProblem('quadratic', 'en', seed);
      const step = p.steps[1];
      // Never "−6²" or "× −3": a negative number after ² or × must be in brackets.
      expect(step, step).not.toMatch(/= −\d+²|× −\d/);
    }
  });

  it('writes problems in all four languages', () => {
    expect(makeProblem('quadratic', 'fr', 1).prompt).toMatch(/^Résous/);
    expect(makeProblem('quadratic', 'es', 1).prompt).toMatch(/^Resuelve/);
    expect(makeProblem('quadratic', 'ar', 1).prompt).toMatch(/^حلّ/);
  });

  it('suggests topics that match the book', () => {
    expect(suggestTopics('The discriminant of a quadratic equation')).toContain('quadratic');
    expect(suggestTopics('Subnetting an IPv4 network with a /26 prefix')).toContain('subnet');
    expect(suggestTopics('A real apology repairs trust.')).toEqual([]);
  });
});
