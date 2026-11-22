import { describe, expect, it } from 'vitest';
import { cleanOcrText } from '../src/loaders/ocrclean';

const photo = `Figure 4.2: The Default Gateway

A host sends a frame to its default gateway when the
destination is on another network. The default gateway is the
router interface on the local network.

If the gateway address on a PC is wrong, the PC can still ping
hosts on its own network, but it cannot reach other networks.

Router R1

Switch S1 Switch S2

PC1 PC3
192.168.10.0/24 192.168.11.0/24
`;

describe('OCR clean up', () => {
  it('joins lines back into full sentences', () => {
    const { text } = cleanOcrText(photo);
    expect(text).toContain('If the gateway address on a PC is wrong, the PC can still ping hosts on its own network, but it cannot reach other networks.');
    expect(text).toContain('when the destination is on another network.');
  });
  it('keeps the title and sets diagram labels aside, without losing them', () => {
    const { text, labels } = cleanOcrText(photo);
    expect(text.startsWith('Figure 4.2: The Default Gateway')).toBe(true);
    expect(text).not.toContain('PC1 PC3');
    expect(labels).toEqual(['Router R1', 'Switch S1 Switch S2', 'PC1 PC3', '192.168.10.0/24 192.168.11.0/24']);
  });
  it('keeps short headings that come before a paragraph', () => {
    const { text, labels } = cleanOcrText('Chapter 1\n\nIntro text here.\n\nSummary\n\nThe gateway is the router on the local network.');
    expect(text).toContain('Summary');
    expect(labels).toEqual([]);
  });
  it('rejoins words split with a hyphen at the end of a line', () => {
    expect(cleanOcrText('Intro\n\nThe local net-\nwork has a gateway.').text).toContain('local network has');
  });
  it('handles real OCR output with a blank line after every line', () => {
    const raw = 'Figure 4.2: The Default Gateway\n\nA host sends a frame to its default gateway when the\n\ndestination is on another network. The default gateway is the\n\nrouter interface on the local network.\n\nIf the gateway address on a PC is wrong, the PC can still ping\n\nhosts on its own network, but it cannot reach other networks.\n\nPCI PC3\n\n192.168.10.0/24 192.168.11.0/24\n';
    const { text, labels } = cleanOcrText(raw);
    expect(text.split('\n\n')).toEqual([
      'Figure 4.2: The Default Gateway',
      'A host sends a frame to its default gateway when the destination is on another network. The default gateway is the router interface on the local network.',
      'If the gateway address on a PC is wrong, the PC can still ping hosts on its own network, but it cannot reach other networks.',
    ]);
    expect(labels).toEqual(['PCI PC3', '192.168.10.0/24 192.168.11.0/24']);
  });
  it('works for Arabic too', () => {
    const { text } = cleanOcrText('عنوان\n\nالبوابة الافتراضية هي واجهة الموجه\nعلى الشبكة المحلية.');
    expect(text).toContain('واجهة الموجه على الشبكة المحلية.');
  });
});
