// src/app/api/payments/checkout/route.ts
import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma";
import Stripe from "stripe";

export const runtime = "nodejs";

type Body = {
    reservationId: string;
};

function calcAmountCents(args: {
    adultsCount: number;
    minorsCount: number;
    adultPriceCents: number;
    minorPriceCents: number;
}): number {
    const { adultsCount, minorsCount, adultPriceCents, minorPriceCents } = args;
    return adultsCount * adultPriceCents + minorsCount * minorPriceCents;
}

export async function POST(req: Request) {
    const body = (await req.json()) as Body;

    if (!body.reservationId) {
        return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const now = new Date();

    // 1) Cargar reserva + session + payment + customer
    const reservation = await prisma.reservation.findUnique({
        where: { id: body.reservationId },
        include: { session: true, payment: true, customer: true },
    });

    if (!reservation) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (!reservation.payment) {
        return NextResponse.json({ error: "Payment record missing" }, { status: 500 });
    }

    // 2) Validaciones de negocio
    if (reservation.status !== ReservationStatus.HOLD) {
        return NextResponse.json({ error: "Reservation must be HOLD to pay" }, { status: 400 });
    }

    if (reservation.holdExpiresAt && reservation.holdExpiresAt < now) {
        return NextResponse.json({ error: "Reservation HOLD expired" }, { status: 400 });
    }

    if (reservation.payment.status === PaymentStatus.SUCCEEDED) {
        return NextResponse.json({ error: "Already paid" }, { status: 409 });
    }

    // 3) Total server-truth: se calcula SIEMPRE desde DB (pax + precios sesión)
    const expectedAmountCents = calcAmountCents({
        adultsCount: reservation.adultsCount,
        minorsCount: reservation.minorsCount,
        adultPriceCents: reservation.session.adultPriceCents,
        minorPriceCents: reservation.session.minorPriceCents,
    });

    const expectedCurrency = reservation.session.currency;

    // Self-heal: si el Payment placeholder quedó desfasado, lo corregimos antes de crear checkout
    if (
        reservation.payment.amountCents !== expectedAmountCents ||
        reservation.payment.currency !== expectedCurrency
    ) {
        await prisma.payment.update({
            where: { id: reservation.payment.id },
            data: {
                amountCents: expectedAmountCents,
                currency: expectedCurrency,
            },
        });

        // refrescamos localmente para seguir con valores correctos
        reservation.payment.amountCents = expectedAmountCents;
        reservation.payment.currency = expectedCurrency;
    }

    // 4) Idempotencia práctica:
    // Si ya tenemos un checkoutSessionId, intentamos reutilizarlo.
    if (reservation.payment.stripeCheckoutSessionId) {
        try {
            const existing = await stripe.checkout.sessions.retrieve(
                reservation.payment.stripeCheckoutSessionId
            );

            // Si Stripe aún nos da una URL, normalmente sigue siendo utilizable
            if (existing.url) {
                return NextResponse.json({ ok: true, checkoutUrl: existing.url, reused: true });
            }
        } catch {
            // si falla retrieve, seguimos y creamos nueva
        }
    }

    // 5) Crear Checkout Session
    const amount = reservation.payment.amountCents;
    const currency = reservation.payment.currency;

    // Idempotency key: 1 checkout "activo" por payment
    const idempotencyKey = `checkout_${reservation.payment.id}`;

    // Stripe: expires_at debe estar entre 30 min y 24h desde ahora.
    const expiresAtSeconds =
        reservation.holdExpiresAt &&
            reservation.holdExpiresAt.getTime() - now.getTime() >= 30 * 60 * 1000
            ? Math.floor(reservation.holdExpiresAt.getTime() / 1000)
            : undefined;

    // Line items: 2 líneas (adultos/menores) para que el desglose sea claro
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (reservation.adultsCount > 0) {
        lineItems.push({
            quantity: reservation.adultsCount,
            price_data: {
                currency,
                unit_amount: reservation.session.adultPriceCents,
                product_data: { name: "DeltaRoutes · Adulto" },
            },
        });
    }

    if (reservation.minorsCount > 0) {
        lineItems.push({
            quantity: reservation.minorsCount,
            price_data: {
                currency,
                unit_amount: reservation.session.minorPriceCents,
                product_data: { name: "DeltaRoutes · Menor" },
            },
        });
    }

    // Fallback (no debería pasar porque adultsCount >= 1)
    if (lineItems.length === 0) {
        lineItems.push({
            quantity: 1,
            price_data: {
                currency,
                unit_amount: amount,
                product_data: { name: "DeltaRoutes · Reserva" },
            },
        });
    }

    let session: Stripe.Checkout.Session;

    try {
        session = await stripe.checkout.sessions.create(
            {
                mode: "payment",

                ...(expiresAtSeconds ? { expires_at: expiresAtSeconds } : {}),

                // Stripe acepta undefined; si tu email es obligatorio en Customer, nunca será null igualmente
                customer_email: reservation.customer.email ?? undefined,

                line_items: lineItems,

                success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${appUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,

                metadata: {
                    reservationId: reservation.id,
                    paymentId: reservation.payment.id,
                },
            },
            { idempotencyKey }
        );
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Stripe error";
        return NextResponse.json({ error: message }, { status: 500 });
    }

    // 6) Persistir refs Stripe en tu Payment
    await prisma.payment.update({
        where: { id: reservation.payment.id },
        data: {
            status: PaymentStatus.PENDING,
            stripeCheckoutSessionId: session.id,
        },
    });

    return NextResponse.json({ ok: true, checkoutUrl: session.url, reused: false });
}
