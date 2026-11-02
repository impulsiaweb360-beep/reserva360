import Stripe from 'stripe';

let _stripe = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const e = new Error('Stripe no está configurado todavía (falta la clave secreta).');
    e.status = 503;
    throw e;
  }
  if (!_stripe) {
    const opts = {};
    if (process.env.STRIPE_API_VERSION) opts.apiVersion = process.env.STRIPE_API_VERSION;
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, opts);
  }
  return _stripe;
}
