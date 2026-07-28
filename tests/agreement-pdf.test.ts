import { describe, expect, it, vi } from 'vitest';

const pdfText = vi.hoisted((): string[] => []);

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

  return { default: MockJsPDF };
});

describe('generateAgreementPdf', () => {
  it('does not add clauses that are absent from the displayed agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    pdfText.length = 0;
    generateAgreementPdf({
      signerName: 'Priya Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '28 Jul 2026',
    });

    const rendered = pdfText.join('\n');

    expect(rendered).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period. Failure to pay within this period allows suspension of Platform access.',
    );
    expect(rendered).toContain(
      '7.3. Upon termination: Fuzone shall cease Platform use and clear outstanding dues. The Service Provider shall provide all raw Client Data within fifteen (15) business days.',
    );
    expect(rendered).toContain(
      '15.1. Disputes shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, conducted by a sole arbitrator mutually appointed within fifteen (15) days.',
    );

    expect(rendered).not.toContain(
      'During the grace period, services shall continue uninterrupted',
    );
    expect(rendered).not.toContain('interest or penalties from prior non-payment');
    expect(rendered).not.toContain('fees materially changed mid-term');
    expect(rendered).not.toContain('appointment shall follow Section 11');
    expect(rendered).not.toContain('Each Party shall remain individually responsible');
  });
});
