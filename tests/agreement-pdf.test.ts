import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfText: string[] = [];

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
        pdfText.push(...text);
      } else {
        pdfText.push(text);
      }
    }
  }

  return { default: vi.fn(() => new MockJsPDF()) };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfText.length = 0;
  });

  it('does not emit legal clauses that are absent from the displayed agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Test Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '5 August 2026',
    });

    const text = pdfText.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '7.3. Upon termination: Fuzone shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain(
      'Either Party may terminate immediately if Platform services are discontinued or fees materially changed mid-term.',
    );
    expect(text).not.toContain('The affected Party shall promptly notify the other in writing.');
    expect(text).not.toContain('appointment shall follow Section 11 of the Act');
  });
});
