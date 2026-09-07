import { beforeEach, describe, expect, it, vi } from 'vitest';

const { savedFiles, textCalls } = vi.hoisted(() => ({
  savedFiles: [] as string[],
  textCalls: [] as string[],
}));

vi.mock('jspdf', () => ({
  default: class MockJsPDF {
    addImage() {}
    addPage() {}
    line() {}
    save(fileName: string) {
      savedFiles.push(fileName);
    }
    setDrawColor() {}
    setFont() {}
    setFontSize() {}
    setTextColor() {}
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
  },
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    savedFiles.length = 0;
    textCalls.length = 0;
  });

  it('does not add legal terms that are absent from the signed agreement page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Test Signer',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '7 September 2026',
    });

    const text = textCalls.join('\n');

    expect(text).not.toContain('services shall continue uninterrupted');
    expect(text).not.toContain('interest or penalties from prior non-payment');
    expect(text).not.toContain('ticket price or transaction amount');
    expect(text).not.toContain('terminate immediately if Platform services are discontinued');
    expect(text).not.toContain('regulatory duties');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );
    expect(savedFiles).toEqual(['Service Agreement Fuzone.pdf']);
  });
});
