import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfOutput = vi.hoisted(() => ({
  text: [] as string[],
  savedFiles: [] as string[],
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
    addPage() {}

    setFont() {}

    setFontSize() {}

    setTextColor() {}

    setDrawColor() {}

    line() {}

    splitTextToSize(text: string) {
      return [text];
    }

    text(content: string | string[]) {
      pdfOutput.text.push(Array.isArray(content) ? content.join(' ') : content);
    }

    addImage() {}

    save(fileName: string) {
      pdfOutput.savedFiles.push(fileName);
    }
  }

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfOutput.text = [];
    pdfOutput.savedFiles = [];
  });

  it('does not add PDF-only legal clauses absent from the signed agreement page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Jane Signer',
      companyName: 'Fuzone Bengaluru Pvt Ltd',
      signatureDataUrl: 'data:image/png;base64,signature',
      date: '31 May 2026',
    });

    const text = pdfOutput.text.join('\n');

    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain(
      'Either Party may terminate immediately if Platform services are discontinued',
    );
    expect(text).not.toContain('Each Party shall remain individually responsible');
    expect(text).not.toContain('The liability cap is based on actual commissions');
    expect(text).not.toContain('This limitation applies to all claims under this Agreement');
    expect(text).not.toContain('The affected Party shall promptly notify the other in writing');
    expect(text).not.toContain('appointment shall follow Section 11 of the Act');
    expect(pdfOutput.savedFiles).toEqual(['Service Agreement Fuzone Bengaluru Pvt Ltd.pdf']);
  });
});
