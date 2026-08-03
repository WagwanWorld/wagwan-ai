import { describe, expect, it, vi } from 'vitest';

class MockJsPdf {
  static instances: MockJsPdf[] = [];

  texts: string[] = [];
  savedName = '';

  constructor() {
    MockJsPdf.instances.push(this);
  }

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

  text(value: string | string[]) {
    if (Array.isArray(value)) {
      this.texts.push(...value);
    } else {
      this.texts.push(value);
    }
  }

  save(name: string) {
    this.savedName = name;
  }
}

vi.mock('jspdf', () => ({ default: MockJsPdf }));

describe('generateAgreementPdf', () => {
  it('does not include clauses absent from the displayed agreement', async () => {
    const { generateAgreementPdf } = await import('../src/lib/utils/agreementPdf');

    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '3 August 2026',
    });

    const rendered = MockJsPdf.instances.at(-1)?.texts.join('\n') ?? '';

    expect(rendered).toContain(
      'This Service Agreement (hereinafter referred to as the "Agreement") is made and entered into on the date of digital execution below',
    );
    expect(rendered).toContain(
      '5.5. In the event of payment default, the Service Provider shall provide a seven (7) day grace period.',
    );
    expect(rendered).toContain(
      '7.1. This Agreement shall commence on the Effective Date and remain in effect for the period stated in Clause 3',
    );
    expect(rendered).toContain('15.2. Seat and venue: Bengaluru, Karnataka.');

    expect(rendered).not.toContain('5.7. During the grace period');
    expect(rendered).not.toContain('claim interest or penalties from prior non-payment');
    expect(rendered).not.toContain('fees materially changed mid-term');
    expect(rendered).not.toContain('Each Party shall remain individually responsible');
    expect(rendered).not.toContain('liability cap is based on actual commissions');
    expect(rendered).not.toContain('The affected Party shall promptly notify the other in writing');
    expect(rendered).not.toContain('appointment shall follow Section 11');
  });
});
