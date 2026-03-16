/**
 * Stripe API – Mobile integration
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getApiBaseUrl } from './apiConfig';

const STRIPE_BASE = `${getApiBaseUrl()}/api/stripe`;

type StripeCurrency = 'gbp' | 'usd' | 'eur' | 'cad' | 'aud';

export interface StripeConfigResponse {
  configured: boolean;
  publishableKey: string | null;
}

export interface CreatePaymentIntentPayload {
  amount: number;
  currency?: StripeCurrency;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface StripePaymentSuccessResponse {
  success: boolean;
  status?: string;
}

function getErrorMessageFromText(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    const json = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
    if (typeof json.error === 'string' && json.error.trim()) return json.error.trim();
    if (typeof json.message === 'string' && json.message.trim()) return json.message.trim();
  } catch {
    // Ignore JSON parse errors and use raw text.
  }
  return trimmed;
}

export async function getStripeConfig(): Promise<StripeConfigResponse> {
  const res = await fetch(`${STRIPE_BASE}/config`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(getErrorMessageFromText(text, 'Unable to load Stripe configuration.'));
  }

  const json = (await res.json().catch(() => ({}))) as Partial<StripeConfigResponse>;
  return {
    configured: Boolean(json.configured),
    publishableKey: typeof json.publishableKey === 'string' ? json.publishableKey : null,
  };
}

export async function createPaymentIntent(
  payload: CreatePaymentIntentPayload
): Promise<CreatePaymentIntentResponse> {
  const res = await fetch(`${STRIPE_BASE}/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(getErrorMessageFromText(text, 'Unable to start payment.'));
  }

  const json = (await res.json().catch(() => ({}))) as Partial<CreatePaymentIntentResponse>;
  if (!json.clientSecret || !json.paymentIntentId) {
    throw new Error('Invalid Stripe response: missing payment details.');
  }

  return {
    clientSecret: json.clientSecret,
    paymentIntentId: json.paymentIntentId,
  };
}

export async function verifyStripePaymentSuccess(
  paymentIntentId: string,
  orderId?: string
): Promise<StripePaymentSuccessResponse> {
  const body: { paymentIntentId: string; orderId?: string } = { paymentIntentId };
  if (orderId != null && String(orderId).trim()) body.orderId = String(orderId).trim();

  const res = await fetch(`${STRIPE_BASE}/payment-success`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(getErrorMessageFromText(text, 'Unable to verify payment status.'));
  }

  const json = (await res.json().catch(() => ({}))) as Partial<StripePaymentSuccessResponse>;
  return {
    success: Boolean(json.success),
    status: typeof json.status === 'string' ? json.status : undefined,
  };
}
