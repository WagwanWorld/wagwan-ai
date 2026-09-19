import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfText: string[] = [];

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
          pdfText.push(...text);
        } else {
          pdfText.push(text);
        }
      }
      save() {}
    },
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    pdfText.length = 0;
  });

  it('does not add legal clauses absent from the visible agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Riya',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '19 September 2026',
    });

    const text = pdfText.join('\n');
    expect(text).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(text).not.toContain('During the grace period, services shall continue uninterrupted');
    expect(text).not.toContain('Reinstatement shall not waive');
    expect(text).not.toContain('fees materially changed mid-term');
    expect(text).not.toContain('appointment shall follow Section 11');
  });
});
