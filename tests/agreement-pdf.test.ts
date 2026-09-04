import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const pdfState = vi.hoisted(() => ({
  text: [] as string[],
  save: vi.fn(),
}));

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addPage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    addImage: vi.fn(),
    save: pdfState.save,
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn((text: string | string[]) => {
      if (Array.isArray(text)) {
        pdfState.text.push(...text);
      } else {
        pdfState.text.push(text);
      }
    }),
  })),
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.text = [];
    pdfState.save.mockClear();
  });

  it('does not add legal clauses that are absent from the signed page', () => {
    generateAgreementPdf({
      signerName: 'Jane Doe',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '4 September 2026',
    });

    const text = pdfState.text.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(text).not.toContain('services shall continue uninterrupted');
    expect(text).not.toContain('interest or penalties from prior non-payment');
    expect(text).not.toContain('terminate immediately');
    expect(text).not.toContain('Section 11 of the Act');
    expect(text).not.toContain('actual commissions and subscription revenues');
    expect(text).not.toContain('promptly notify the other in writing');
  });
});
