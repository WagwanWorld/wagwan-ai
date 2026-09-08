import { beforeEach, describe, expect, it, vi } from 'vitest';

const capturedText = vi.hoisted((): string[] => []);

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    addPage: vi.fn(),
    line: vi.fn(),
    save: vi.fn(),
    setDrawColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn((text: string | string[]) => {
      if (Array.isArray(text)) {
        capturedText.push(...text);
      } else {
        capturedText.push(text);
      }
    }),
  })),
}));

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    capturedText.length = 0;
  });

  it('does not add legal clauses that are absent from the signed agreement page', () => {
    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '2026-09-08',
    });

    const text = capturedText.join('\n');
    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('ticket price or transaction amount');
    expect(text).not.toContain('shall immediately cease all use of the Platform');
    expect(text).not.toContain('Platform services are discontinued or fees materially changed');
    expect(text).not.toContain('actual commissions and subscription revenues');
    expect(text).not.toContain('affected Party shall promptly notify');
    expect(text).not.toContain('appointment shall follow Section 11');
  });
});
