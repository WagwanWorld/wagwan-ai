import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAgreementPdf } from '../src/lib/utils/agreementPdf';

const textCalls: string[] = [];

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      addPage: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      setDrawColor: vi.fn(),
      line: vi.fn(),
      splitTextToSize: vi.fn((text: string) => [text]),
      text: vi.fn((text: string | string[]) => {
        if (Array.isArray(text)) {
          textCalls.push(...text);
        } else {
          textCalls.push(text);
        }
      }),
      addImage: vi.fn(),
      save: vi.fn(),
    })),
  };
});

describe('generateAgreementPdf', () => {
  beforeEach(() => {
    textCalls.length = 0;
  });

  it('does not add payment clauses absent from the signed agreement page', () => {
    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '28 August 2026',
    });

    const text = textCalls.join('\n');

    expect(text).toContain(
      'Failure to pay within this period allows suspension of Platform access.',
    );
    expect(text).not.toContain('During the grace period, services shall continue uninterrupted.');
    expect(text).not.toContain("Reinstatement shall not waive the Service Provider's right");
  });

  it('does not add termination, liability, or arbitration terms absent from the page', () => {
    generateAgreementPdf({
      signerName: 'Asha Rao',
      companyName: 'Fuzone',
      signatureDataUrl: null,
      date: '28 August 2026',
    });

    const text = textCalls.join('\n');

    expect(text).not.toContain('terminate immediately if Platform services are discontinued');
    expect(text).not.toContain('liability cap is based on actual commissions');
    expect(text).not.toContain('appointment shall follow Section 11');
    expect(text).toContain('Award shall be final and binding.');
  });
});
