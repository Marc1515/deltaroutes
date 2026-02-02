import "dotenv/config";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma";

// Stripe SDK necesita runtime Node (no Edge)
export const runtime = "nodejs";

export async function POST(req: Request) {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
        return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid signature";
        return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Solo manejamos este evento por ahora
    if (event.type !== "checkout.session.completed") {
        return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // ✅ check 1: realmente pagado
    if (session.payment_status !== "paid") {
        // Stripe a veces manda completed pero no paid en ciertos flujos;
        // para tu caso (payment) queremos paid.
        return NextResponse.json({ received: true, ignored: "not_paid" });
    }

    const reservationId = session.metadata?.reservationId;
    if (!reservationId) {
        return NextResponse.json({ error: "Missing metadata reservationId" }, { status: 400 });
    }

    const checkoutSessionId = session.id;
    const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : undefined;

    if (process.env.NODE_ENV !== "production") {
        await new Promise((r) => setTimeout(r, 10_000));
    }


    try {
        await prisma.$transaction(async (tx) => {
            // Traemos la reserva + payment para validar y hacer idempotente
            const reservation = await tx.reservation.findUnique({
                where: { id: reservationId },
                include: { payment: true },
            });

            if (!reservation || !reservation.payment) {
                // Si esto pasa, es un bug de lógica (no debería existir checkout sin payment)
                throw new Error("Reservation or payment not found for reservationId");
            }

            // ✅ idempotencia: si ya está confirmado y cobrado, no hacemos nada
            if (
                reservation.status === ReservationStatus.CONFIRMED &&
                reservation.payment.status === PaymentStatus.SUCCEEDED
            ) {
                return;
            }

            // ✅ check 2: no confirmamos si ya expiró/canceló (evita “revivir” reservas)
            if (reservation.status !== ReservationStatus.HOLD) {
                // ejemplo: EXPIRED / CANCELLED / WAITING...
                return;
            }

            // ✅ check 3: validar importe y moneda (muy recomendado)
            // Nota: Stripe manda currency en minúsculas normalmente
            const stripeAmount = session.amount_total ?? null;
            const stripeCurrency = session.currency ?? null;

            if (stripeAmount === null || stripeCurrency === null) {
                throw new Error("Stripe session missing amount_total or currency");
            }

            if (stripeAmount !== reservation.payment.amountCents) {
                throw new Error(
                    `Amount mismatch: stripe=${stripeAmount} db=${reservation.payment.amountCents}`
                );
            }

            if (stripeCurrency.toLowerCase() !== reservation.payment.currency.toLowerCase()) {
                throw new Error(
                    `Currency mismatch: stripe=${stripeCurrency} db=${reservation.payment.currency}`
                );
            }

            // 1) marcar payment como SUCCEEDED + guardar ids Stripe
            await tx.payment.update({
                where: { id: reservation.payment.id },
                data: {
                    status: PaymentStatus.SUCCEEDED,
                    stripeCheckoutSessionId: checkoutSessionId,
                    stripePaymentIntentId: paymentIntentId ?? undefined,
                },
            });

            // 2) confirmar reserva (y limpiar hold)
            await tx.reservation.update({
                where: { id: reservationId },
                data: {
                    status: ReservationStatus.CONFIRMED,
                    holdExpiresAt: null,
                },
            });
        });

        return NextResponse.json({ received: true });
    } catch (e: unknown) {
        // Importante: si devuelves 500 Stripe reintentará => bien para resiliencia
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ received: false, error: message }, { status: 500 });
    }
}
