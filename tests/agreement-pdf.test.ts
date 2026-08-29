import { beforeEach, describe, expect, it, vi } from 'vitest';

const { savedFiles, textCalls } = vi.hoisted(() => ({
  savedFiles: [] as string[],
  textCalls: [] as string[],
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addPage() {}
    addHeader() {}
    addImage() {}

    splitTextToSize(text: string) {
      return [text];
    }

    text(text: string | string[]) {
      if (Array.isArray(text)) {
        textCalls.push(...text);
        return;
      }

      textCalls.push(text);
    }

    save(fileName: string) {
      savedFiles.push(fileName);
    }
  }

  return { default: MockJsPDF };
});

import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    savedFiles.length = 0;
    textCalls.length = 0;
  });

  it('matches the visible agreement terms and omits hidden PDF-only clauses', () => {
    generateAgreementPdf({
      signerName: 'Anika Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '29 August 2026',
    });

    const pdfText = textCalls.join('\n');

    expect(savedFiles).toEqual(['Service Agreement Fuzone.pdf']);
    expect(pdfText).toContain(
      'Failure to pay within this period allows suspension of Platform access.',
    );
    expect(pdfText).toContain(
      'Upon termination: Fuzone shall cease Platform use and clear outstanding dues.',
    );
    expect(pdfText).toContain(
      '7.1. This Agreement shall commence on the Effective Date and remain in effect for three (3) years.',
    );
    expect(pdfText).toContain(
      'This indemnity shall not extend to liability arising from the Service Provider',
    );
    expect(pdfText).toContain(
      'Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(pdfText).not.toContain(
      'During the grace period, services shall continue uninterrupted.',
    );
    expect(pdfText).not.toContain(
      "Reinstatement shall not waive the Service Provider's right to claim interest or penalties",
    );
    expect(pdfText).not.toContain('Either Party may terminate immediately');
    expect(pdfText).not.toContain('appointment shall follow Section 11 of the Act');
    expect(pdfText).not.toContain('This limitation applies to all claims under this Agreement.');
    expect(pdfText).not.toContain('remain in effect for 12 months');
  });
});
