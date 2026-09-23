import { beforeEach, describe, expect, it, vi } from 'vitest';

const textCalls: string[] = [];

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addPage() {}
    addImage() {}
    save() {}
    splitTextToSize(text: string) {
      return [text];
    }
    text(text: string | string[]) {
      if (Array.isArray(text)) {
        textCalls.push(...text);
      } else {
        textCalls.push(text);
      }
    }
  }

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    textCalls.length = 0;
  });

  it('does not emit legal clauses that are absent from the visible agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Client Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '23 September 2026',
    });

    const pdfText = textCalls.join('\n');
    expect(pdfText).not.toContain('services shall continue uninterrupted');
    expect(pdfText).not.toContain('claim interest or penalties');
    expect(pdfText).not.toContain('terminate immediately if Platform services are discontinued');
    expect(pdfText).not.toContain('Section 11 of the Act');
    expect(pdfText).toContain(
      '5.6. Upon receipt of all outstanding payments, access shall be reinstated within two (2) business days.',
    );
  });
});
