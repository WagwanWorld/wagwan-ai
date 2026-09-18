import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderedText = vi.hoisted(() => [] as string[]);

vi.mock('jspdf', () => ({
  default: class MockJsPdf {
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
        renderedText.push(...text);
      } else {
        renderedText.push(text);
      }
    }
  },
}));

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    renderedText.length = 0;
  });

  it('does not add legal clauses absent from the signing page', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '18 September 2026',
    });

    const body = renderedText.join('\n');

    expect(body).not.toContain('services shall continue uninterrupted');
    expect(body).not.toContain('claim interest or penalties from prior non-payment');
    expect(body).not.toContain('ticket price or transaction amount');
    expect(body).not.toContain('fees materially changed mid-term');
    expect(body).not.toContain('appointment shall follow Section 11');
    expect(body).toContain(
      'Failure to pay within this period allows suspension of Platform access.',
    );
    expect(body).toContain(
      'conducted by a sole arbitrator mutually appointed within fifteen (15) days',
    );
  });
});
