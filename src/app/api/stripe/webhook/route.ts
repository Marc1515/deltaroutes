import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, PaymentStatus } from "@/generated/prisma";
import { sendEmail } from "@/lib/email";
import PaymentConfirmedEmail from "@/emails/PaymentConfirmedEmail";

export const runtime = "nodejs";

const madridFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
});

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
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET as string) as Stripe.Event;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid signature";
        return NextResponse.json({ error: msg }, { status: 400 });
    }

    console.log("[stripe-webhook] received:", event.type);

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const dataObj = event.data.object;

                if (!isCheckoutSession(dataObj)) {
                    return NextResponse.json({ ok: true, ignored: "not_checkout_session" });
                }

                const session = dataObj;

                console.log("[stripe-webhook] completed:", {
                    id: session.id,
                    payment_status: session.payment_status,
                    amount_total: session.amount_total,
                    currency: session.currency,
                    metadata: session.metadata,
                });

                if (session.payment_status !== "paid") {
                    return NextResponse.json({ ok: true, ignored: "not_paid" });
                }

                // 1) Intentamos por metadata (ideal)
                const reservationId = getMetadataValue(session, "reservationId");

                // 2) Fallback por stripeCheckoutSessionId (por si metadata faltase)
                const reservation = reservationId
                    ? await prisma.reservation.findUnique({
                        where: { id: reservationId },
                        include: { payment: true, customer: true, session: true },
                    })
                    : await prisma.reservation.findFirst({
                        where: { payment: { stripeCheckoutSessionId: session.id } },
                        include: { payment: true, customer: true, session: true },
                    });

                if (!reservation || !reservation.payment) {
                    return NextResponse.json(
                        { error: "Reservation/payment not found", reservationId, sessionId: session.id },
                        { status: 404 }
                    );
                }

                const payment = reservation.payment;

                // Idempotencia: si ya está confirmado/pagado, no hacemos nada
                if (reservation.status === ReservationStatus.CONFIRMED && payment.status === PaymentStatus.SUCCEEDED) {
                    return NextResponse.json({ ok: true, alreadyConfirmed: true });
                }

                // No revivir reservas
                if (reservation.status !== ReservationStatus.HOLD) {
                    return NextResponse.json({ ok: true, ignored: "reservation_not_hold", status: reservation.status });
                }

                if (session.amount_total == null) {
                    throw new Error("Stripe session.amount_total is null");
                }
                if (!session.currency) {
                    throw new Error("Stripe session.currency is null");
                }

                const stripeAmount = session.amount_total;
                const stripeCurrency = session.currency.toLowerCase();

                // Validación fuerte (mantengo tu regla)
                if (stripeAmount !== payment.amountCents || stripeCurrency !== payment.currency.toLowerCase()) {
                    throw new Error(
                        `Amount/currency mismatch. stripe=${stripeAmount} ${stripeCurrency} db=${payment.amountCents} ${payment.currency}`
                    );
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

                console.log("[stripe-webhook] CONFIRMED:", reservation.id);

                // Email idempotente (NO bloquear webhook)
                try {
                    const mark = await prisma.reservation.updateMany({
                        where: { id: reservation.id, confirmedEmailSentAt: { equals: null } },
                        data: { confirmedEmailSentAt: new Date() },
                    });

                    if (mark.count === 1) {
                        const reservationCode = `DR-${reservation.id.slice(0, 8).toUpperCase()}`;
                        const activityLabel = `Sesión ${reservation.sessionId.slice(0, 8).toUpperCase()}`;

                        // Usa el campo real de inicio del tour
                        const startText = madridFormatter.format(reservation.session.startAt);

                        const languageLabel = reservation.tourLanguage;
                        const amountText = `${(payment.amountCents / 100).toFixed(2)} ${payment.currency.toUpperCase()}`;

                        void sendEmail({
                            to: reservation.customer.email,
                            subject: `DeltaRoutes · Reserva confirmada (${reservationCode})`,
                            react: PaymentConfirmedEmail({
                                customerName: reservation.customer.name ?? "Cliente",
                                activityLabel,
                                startText,
                                languageLabel,
                                reservationCode,
                                amountText,
                            }),
                        }).catch((e) => console.warn("[stripe-webhook] email failed:", e));
                    }
                } catch (e) {
                    console.warn("[stripe-webhook] email prep failed:", e);
                }

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

                if (reservation.status === ReservationStatus.CONFIRMED && payment.status === PaymentStatus.SUCCEEDED) {
                    return NextResponse.json({ ok: true, alreadyPaid: true });
                }

                if (reservation.status === ReservationStatus.HOLD) {
                    await prisma.$transaction(async (tx) => {
                        await tx.reservation.update({
                            where: { id: reservation.id },
                            data: { status: ReservationStatus.EXPIRED, holdExpiresAt: null },
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
        console.error("[stripe-webhook] ERROR:", msg);

        // 500 para que Stripe reintente si fue fallo real
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
