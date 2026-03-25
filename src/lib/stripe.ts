// src/lib/stripe.ts
import Stripe from "stripe";

export function getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error("Missing STRIPE_SECRET_KEY env var");
    }

    return new Stripe(secretKey, {
        apiVersion: "2025-12-15.clover",
    });
}