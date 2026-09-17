import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const pdfMock = vi.hoisted(() => ({
  textCalls: [] as string[],
  savedFiles: [] as string[],
}));

vi.mock('jspdf', () => ({
  default: class MockJsPDF {
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
        pdfMock.textCalls.push(...text);
      } else {
        pdfMock.textCalls.push(text);
      }
    }
    save(fileName: string) {
      pdfMock.savedFiles.push(fileName);
    }
  },
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfMock.textCalls.length = 0;
    pdfMock.savedFiles.length = 0;
  });

  it('does not add hidden PDF-only legal clauses absent from the signing page', () => {
    generateAgreementPdf({
      signerName: 'Asha',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '17 September 2026',
    });

    const pdfText = pdfMock.textCalls.join('\n');
    expect(pdfText).toContain('Failure to pay within this period allows suspension');
    expect(pdfText).toContain(
      'Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
    );
    expect(pdfText).not.toContain(
      'During the grace period, services shall continue uninterrupted.',
    );
    expect(pdfText).not.toContain('Reinstatement shall not waive');
    expect(pdfText).not.toContain('Platform services are discontinued or fees materially changed');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
    expect(pdfMock.savedFiles).toEqual(['Service Agreement Fuzone.pdf']);
  });
});
