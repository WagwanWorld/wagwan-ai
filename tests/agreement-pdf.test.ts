import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfState = vi.hoisted(() => ({
  texts: [] as string[],
  savedFiles: [] as string[],
}));

vi.mock('jspdf', () => {
  return {
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
          pdfState.texts.push(...text);
        } else {
          pdfState.texts.push(text);
        }
      }
      save(fileName: string) {
        pdfState.savedFiles.push(fileName);
      }
    },
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfState.texts.length = 0;
    pdfState.savedFiles.length = 0;
  });

  it('does not add legal terms that were not displayed on the signing page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone Bengaluru',
      signatureDataUrl: null,
      date: '6 September 2026',
    });

    const pdfText = pdfState.texts.join('\n');

    expect(pdfText).toContain('Failure to pay within this period allows suspension');
    expect(pdfText).toContain('access shall be reinstated within two (2) business days');
    expect(pdfText).toContain('Award shall be final and binding');
    expect(pdfText).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(pdfText).not.toContain('interest or penalties from prior non-payment');
    expect(pdfText).not.toContain('ticket price or transaction amount');
    expect(pdfText).not.toContain('fees materially changed mid-term');
    expect(pdfText).not.toContain('appointment shall follow Section 11');
    expect(pdfState.savedFiles).toEqual(['Service Agreement Fuzone Bengaluru.pdf']);
  });
});
