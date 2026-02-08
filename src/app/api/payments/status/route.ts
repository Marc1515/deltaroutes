import "dotenv/config";
import { NextResponse } from "next/server";
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

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
    const pi = session.payment_intent;
    if (!pi) return null;
    if (typeof pi === "string") return pi;
    return pi.id ?? null;
}

function isPendingPaymentStatus(s: PaymentStatus) {
    return s === PaymentStatus.PENDING || s === PaymentStatus.REQUIRES_PAYMENT;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
        return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // 1) DB: buscamos Payment por stripeCheckoutSessionId
    const payment = await prisma.payment.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        include: {
            reservation: {
                include: {
                    customer: true,
                    session: true,
                },
            },
        },
    });

    if (!payment) {
        // Puede pasar si aún no se guardó stripeCheckoutSessionId o session_id no existe
        return NextResponse.json(
            { ok: false, found: false, message: "Payment not found yet" },
            { status: 404 }
        );
    }

    const reservation = payment.reservation;

    // 2) Si ya está confirmado/pagado, devolvemos tal cual
    if (reservation.status === ReservationStatus.CONFIRMED && payment.status === PaymentStatus.SUCCEEDED) {
        return NextResponse.json({
            ok: true,
            found: true,
            reservationId: reservation.id,
            reservationStatus: reservation.status,
            paymentStatus: payment.status,
            reconciled: false,
        });
    }

    // 3) Self-healing:
    // Si DB dice HOLD + pending, consultamos Stripe y, si está paid, confirmamos nosotros.
    if (reservation.status === ReservationStatus.HOLD && isPendingPaymentStatus(payment.status)) {
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            // Stripe aún no lo marca pagado
            if (session.payment_status !== "paid") {
                return NextResponse.json({
                    ok: true,
                    found: true,
                    reservationId: reservation.id,
                    reservationStatus: reservation.status,
                    paymentStatus: payment.status,
                    reconciled: false,
                    stripePaymentStatus: session.payment_status,
                });
            }

            // amount_total/currency pueden ser null
            if (session.amount_total == null) {
                throw new Error("Stripe session.amount_total is null");
            }
            if (!session.currency) {
                throw new Error("Stripe session.currency is null");
            }

            const stripeAmount = session.amount_total;
            const stripeCurrency = session.currency.toLowerCase();

            // Validación fuerte (igual que en el webhook)
            if (
                stripeAmount !== payment.amountCents ||
                stripeCurrency !== payment.currency.toLowerCase()
            ) {
                throw new Error(
                    `Amount/currency mismatch. stripe=${stripeAmount} ${stripeCurrency} db=${payment.amountCents} ${payment.currency}`
                );
            }

            const paymentIntentId = getPaymentIntentId(session);

            // Idempotencia por si dos polls entran a la vez
            await prisma.$transaction(async (tx) => {
                const freshPayment = await tx.payment.findUnique({
                    where: { id: payment.id },
                    include: { reservation: { select: { status: true } } },
                });

                if (!freshPayment) return;

                // Si ya se confirmó por otro proceso entre medias, no hacemos nada
                if (freshPayment.status === PaymentStatus.SUCCEEDED && freshPayment.reservation?.status === ReservationStatus.CONFIRMED) {
                    return;
                }

                await tx.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: PaymentStatus.SUCCEEDED,
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

            // Email (fire-and-forget) solo si tenemos email (Customer.email es nullable)
            try {
                const toEmail = reservation.customer.email;
                if (toEmail) {
                    const reservationCode = reservation.id.slice(0, 8).toUpperCase();

                    const activityLabel = reservation.session.experienceId
                        ? `Experiencia ${reservation.session.experienceId.slice(0, 8).toUpperCase()}`
                        : `Sesión ${reservation.sessionId.slice(0, 8).toUpperCase()}`;

                    const startText = madridFormatter.format(reservation.session.startAt);
                    const languageLabel = reservation.tourLanguage;
                    const amountText = `${(payment.amountCents / 100).toFixed(2)} ${payment.currency.toUpperCase()}`;

                    sendEmail({
                        to: toEmail,
                        subject: `DeltaRoutes · Reserva confirmada (${reservationCode})`,
                        react: PaymentConfirmedEmail({
                            customerName: reservation.customer.name ?? "Cliente",
                            activityLabel,
                            startText,
                            languageLabel,
                            reservationCode,
                            amountText,
                        }),
                    }).catch((e) => console.warn("[payments/status] email failed:", e));
                }
            } catch (e) {
                console.warn("[payments/status] email prep failed:", e);
            }

            return NextResponse.json({
                ok: true,
                found: true,
                reservationId: reservation.id,
                reservationStatus: ReservationStatus.CONFIRMED,
                paymentStatus: PaymentStatus.SUCCEEDED,
                reconciled: true,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Reconcile error";

            // No rompemos la UI con 500; devolvemos estado DB + motivo
            return NextResponse.json({
                ok: true,
                found: true,
                reservationId: reservation.id,
                reservationStatus: reservation.status,
                paymentStatus: payment.status,
                reconciled: false,
                reconcileError: msg,
            });
        }
    }

    // 4) Default
    return NextResponse.json({
        ok: true,
        found: true,
        reservationId: reservation.id,
        reservationStatus: reservation.status,
        paymentStatus: payment.status,
        reconciled: false,
    });
}
