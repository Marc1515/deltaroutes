import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, PaymentStatus } from "@/generated/prisma";

export const runtime = "nodejs";

function isCheckoutSession(obj: Stripe.Event.Data.Object): obj is Stripe.Checkout.Session {
    return (obj as Stripe.Checkout.Session).object === "checkout.session";
}

function getMetadataValue(session: Stripe.Checkout.Session, key: string): string | null {
    const meta = session.metadata;
    if (!meta) return null;
    const value = meta[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
    const pi = session.payment_intent;
    if (!pi) return null;
    if (typeof pi === "string") return pi;
    return pi.id ?? null;
}

export async function POST(req: NextRequest) {
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
            process.env.STRIPE_WEBHOOK_SECRET as string
        ) as Stripe.Event;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid signature";
        return NextResponse.json({ error: msg }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const dataObj = event.data.object;

                if (!isCheckoutSession(dataObj)) {
                    return NextResponse.json({ ok: true, ignored: "not_checkout_session" });
                }

                const session = dataObj;

                // Confirmamos SOLO si está pagado
                if (session.payment_status !== "paid") {
                    return NextResponse.json({ ok: true, ignored: "not_paid" });
                }

                const reservationId = getMetadataValue(session, "reservationId");
                if (!reservationId) {
                    return NextResponse.json(
                        { error: "Missing reservationId in metadata" },
                        { status: 400 }
                    );
                }

                const reservation = await prisma.reservation.findUnique({
                    where: { id: reservationId },
                    include: { payment: true },
                });

                if (!reservation || !reservation.payment) {
                    return NextResponse.json({ error: "Reservation/payment not found" }, { status: 404 });
                }

                const payment = reservation.payment;

                // Idempotencia
                if (
                    reservation.status === ReservationStatus.CONFIRMED &&
                    payment.status === PaymentStatus.SUCCEEDED
                ) {
                    return NextResponse.json({ ok: true, alreadyConfirmed: true });
                }

                // No revivir reservas (solo confirmamos si estaba en HOLD)
                if (reservation.status !== ReservationStatus.HOLD) {
                    return NextResponse.json({ ok: true, ignored: "reservation_not_hold" });
                }

                // amount_total puede ser null
                if (session.amount_total == null) {
                    throw new Error("Stripe session.amount_total is null");
                }

                // currency puede ser null
                if (!session.currency) {
                    throw new Error("Stripe session.currency is null");
                }

                const stripeAmount = session.amount_total;
                const stripeCurrency = session.currency.toLowerCase();

                // Validación fuerte: importe y moneda deben coincidir con DB
                if (
                    stripeAmount !== payment.amountCents ||
                    stripeCurrency !== payment.currency.toLowerCase()
                ) {
                    throw new Error("Amount/currency mismatch");
                }

                const paymentIntentId = getPaymentIntentId(session);

                await prisma.$transaction(async (tx) => {
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: PaymentStatus.SUCCEEDED,
                            stripeCheckoutSessionId: session.id,
                            stripePaymentIntentId: paymentIntentId,
                        },
                    });

                    await tx.reservation.update({
                        where: { id: reservation.id },
                        data: {
                            status: ReservationStatus.CONFIRMED,
                            holdExpiresAt: null,
                        },
                    });
                });

                return NextResponse.json({ ok: true });
            }

            case "checkout.session.expired": {
                const dataObj = event.data.object;

                if (!isCheckoutSession(dataObj)) {
                    return NextResponse.json({ ok: true, ignored: "not_checkout_session" });
                }

                const session = dataObj;

                const reservationId = getMetadataValue(session, "reservationId");

                const reservation = reservationId
                    ? await prisma.reservation.findUnique({
                        where: { id: reservationId },
                        include: { payment: true },
                    })
                    : await prisma.reservation.findFirst({
                        where: { payment: { stripeCheckoutSessionId: session.id } },
                        include: { payment: true },
                    });

                if (!reservation || !reservation.payment) {
                    return NextResponse.json({ ok: true, ignored: "not_found" });
                }

                const payment = reservation.payment;

                // Si ya está confirmado y pagado, ignoramos
                if (
                    reservation.status === ReservationStatus.CONFIRMED &&
                    payment.status === PaymentStatus.SUCCEEDED
                ) {
                    return NextResponse.json({ ok: true, alreadyPaid: true });
                }

                // Solo expiramos si estaba en HOLD
                if (reservation.status === ReservationStatus.HOLD) {
                    await prisma.$transaction(async (tx) => {
                        await tx.reservation.update({
                            where: { id: reservation.id },
                            data: {
                                status: ReservationStatus.EXPIRED,
                                holdExpiresAt: null,
                            },
                        });

                        await tx.payment.update({
                            where: { id: payment.id },
                            data: { status: PaymentStatus.CANCELED },
                        });
                    });
                }

                return NextResponse.json({ ok: true });
            }

            default:
                return NextResponse.json({ ok: true, ignored: event.type });
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Webhook error";
        // 500 => Stripe reintenta (bien para fallos transitorios)
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
