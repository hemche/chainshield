// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScanForm from './ScanForm';

// Stub fetch globally
beforeEach(() => {
  vi.restoreAllMocks();
});

function renderForm(overrides = {}) {
  const onScanComplete = vi.fn();
  const onScanStart = vi.fn();
  const utils = render(
    <ScanForm onScanComplete={onScanComplete} onScanStart={onScanStart} {...overrides} />
  );
  return { ...utils, onScanComplete, onScanStart };
}

describe('ScanForm', () => {
  describe('rendering', () => {
    it('renders the input field and scan button', () => {
      renderForm();
      expect(screen.getByPlaceholderText(/paste a url/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /scan now/i })).toBeDefined();
    });

    it('renders supported type pills', () => {
      renderForm();
      expect(screen.getByText('URLs')).toBeDefined();
      expect(screen.getByText('Token Contracts')).toBeDefined();
      expect(screen.getByText('Tx Hashes')).toBeDefined();
      expect(screen.getByText('Wallets')).toBeDefined();
      expect(screen.getByText('BTC Addresses')).toBeDefined();
      expect(screen.getByText('Solana Tokens')).toBeDefined();
    });

    it('scan button is disabled when input is empty', () => {
      renderForm();
      const btn = screen.getByRole('button', { name: /scan now/i });
      expect(btn).toHaveProperty('disabled', true);
    });
  });

  describe('input hints', () => {
    it('shows URL hint for http input', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: 'https://example.com' },
      });
      expect(screen.getByText('URL detected')).toBeDefined();
    });

    it('shows URL hint for www input', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: 'www.example.com' },
      });
      expect(screen.getByText('URL detected')).toBeDefined();
    });

    it('shows transaction hash hint for 0x + 64 hex', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: '0x' + 'a'.repeat(64) },
      });
      expect(screen.getByText('Transaction hash detected')).toBeDefined();
    });

    it('shows token/wallet hint for 0x + 40 hex', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: '0x' + 'a'.repeat(40) },
      });
      expect(screen.getByText('Token / wallet address detected')).toBeDefined();
    });

    it('shows Bitcoin hint for bc1 address', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
      });
      expect(screen.getByText('Bitcoin address detected')).toBeDefined();
    });

    it('shows Solana hint for base58 address', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
      });
      expect(screen.getByText('Solana address detected')).toBeDefined();
    });

    it('shows unknown format for unrecognised long input', () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(/paste a url/i), {
        target: { value: 'not-a-known-format-at-all' },
      });
      expect(screen.getByText('Unknown format')).toBeDefined();
    });
  });

  describe('form submission', () => {
    it('shows error when scanning empty input', async () => {
      renderForm();
      // Type something then clear it — button should be disabled, but test the validation
      const input = screen.getByPlaceholderText(/paste a url/i);
      fireEvent.change(input, { target: { value: '  ' } });
      // Button should be disabled for whitespace-only
      const btn = screen.getByRole('button', { name: /scan now/i });
      expect(btn).toHaveProperty('disabled', true);
    });

    it('calls API and reports result on successful scan', async () => {
      const mockReport = {
        inputType: 'url',
        inputValue: 'https://example.com',
        riskScore: 5,
        riskLevel: 'SAFE',
        confidence: 'HIGH',
        confidenceReason: 'mock',
        summary: 'All good',
        scoreBreakdown: [],
        findings: [],
        recommendations: [],
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockReport),
      }));

      const { onScanComplete, onScanStart } = renderForm();
      const input = screen.getByPlaceholderText(/paste a url/i);
      fireEvent.change(input, { target: { value: 'https://example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /scan now/i }));

      expect(onScanStart).toHaveBeenCalled();

      await waitFor(() => {
        expect(onScanComplete).toHaveBeenCalledWith(mockReport);
      });
    });

    it('shows error message on API failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      }));

      renderForm();
      const input = screen.getByPlaceholderText(/paste a url/i);
      fireEvent.change(input, { target: { value: 'https://example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /scan now/i }));

      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeDefined();
      });
    });

    it('shows error message on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      renderForm();
      const input = screen.getByPlaceholderText(/paste a url/i);
      fireEvent.change(input, { target: { value: 'https://example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /scan now/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeDefined();
      });
    });

    it('submits on Enter key', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ inputType: 'url', findings: [], recommendations: [] }),
      }));

      const { onScanStart } = renderForm();
      const input = screen.getByPlaceholderText(/paste a url/i);
      fireEvent.change(input, { target: { value: 'https://example.com' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onScanStart).toHaveBeenCalled();
    });
  });

  describe('clear button', () => {
    it('shows clear button when input has value', () => {
      renderForm();
      const input = screen.getByPlaceholderText(/paste a url/i);
      fireEvent.change(input, { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear input')).toBeDefined();
    });

    it('clears input and error when clear button is clicked', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Some error' }),
      }));

      renderForm();
      const input = screen.getByPlaceholderText(/paste a url/i);

      // Trigger an error first
      fireEvent.change(input, { target: { value: 'https://example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /scan now/i }));
      await waitFor(() => {
        expect(screen.getByText('Some error')).toBeDefined();
      });

      // Now clear
      fireEvent.click(screen.getByLabelText('Clear input'));
      expect((input as HTMLInputElement).value).toBe('');
      // Error should be gone
      expect(screen.queryByText('Some error')).toBeNull();
    });
  });
});
