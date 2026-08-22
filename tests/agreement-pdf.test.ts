import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfText = vi.hoisted(() => ({
  lines: [] as string[],
  savedFiles: [] as string[],
}));

vi.mock('jspdf', () => {
  return {
    default: class MockJsPdf {
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setDrawColor() {}
      line() {}
      addPage() {}
      addImage() {}
      splitTextToSize(text: string) {
        return [text];
      }
      text(text: string | string[]) {
        if (Array.isArray(text)) {
          pdfText.lines.push(...text);
        } else {
          pdfText.lines.push(text);
        }
      }
      save(fileName: string) {
        pdfText.savedFiles.push(fileName);
      }
    },
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfText.lines = [];
    pdfText.savedFiles = [];
  });

  it('emits the signed on-page agreement without hidden PDF-only clauses', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha Client',
      companyName: 'Fuzone Bengaluru',
      signatureDataUrl: null,
      date: '22 August 2026',
    });

    const content = pdfText.lines.join('\n');

    expect(content).toContain(
      '5.6. Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
    );
    expect(content).toContain(
      '7.3. Upon termination: Fuzone Bengaluru shall cease Platform use and clear outstanding dues.',
    );
    expect(content).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(content).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(content).not.toContain('claim interest or penalties from prior non-payment');
    expect(content).not.toContain(
      'Either Party may terminate immediately if Platform services are discontinued',
    );
    expect(content).not.toContain('actual commissions and subscription revenues');
    expect(content).not.toContain('If the Parties cannot agree on an arbitrator');
    expect(content).not.toContain('Section 11 of the Act');
    expect(pdfText.savedFiles).toEqual(['Service Agreement Fuzone Bengaluru.pdf']);
  });
});
