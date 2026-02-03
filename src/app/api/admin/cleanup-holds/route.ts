import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, PaymentStatus } from "@/generated/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
    const now = new Date();

    try {
        // 1) Leemos primero las reservas expiradas con su sessionId de Stripe
        const expiredHolds = await prisma.reservation.findMany({
            where: {
                status: ReservationStatus.HOLD,
                holdExpiresAt: { lt: now },
            },
            select: {
                id: true,
                holdExpiresAt: true,
                payment: {
                    select: {
                        id: true,
                        status: true,
                        stripeCheckoutSessionId: true,
                    },
                },
            },
        });

        if (expiredHolds.length === 0) {
            return NextResponse.json({ ok: true, expiredCount: 0, reservationIds: [], now: now.toISOString() });
        }

        const reservationIds = expiredHolds.map((r) => r.id);

        // Guardamos las sesiones de Stripe a expirar (si existen)
        const stripeSessionIds = expiredHolds
            .map((r) => r.payment?.stripeCheckoutSessionId)
            .filter((x): x is string => Boolean(x));

        // 2) Actualizamos BD en transacción (rápido y consistente)
        await prisma.$transaction(async (tx) => {
            await tx.reservation.updateMany({
                where: { id: { in: reservationIds } },
                data: {
                    status: ReservationStatus.EXPIRED,
                    holdExpiresAt: null,
                },
            });

            await tx.payment.updateMany({
                where: {
                    reservationId: { in: reservationIds },
                    status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT] },
                },
                data: { status: PaymentStatus.CANCELED },
            });
        });

        // 3) Best-effort: expiramos Checkout Sessions en Stripe
        // (si ya están completas/expiradas, Stripe puede devolver error -> lo ignoramos)
        const stripeResults: Array<{ sessionId: string; ok: boolean; error?: string }> = [];

        for (const sessionId of stripeSessionIds) {
            try {
                await stripe.checkout.sessions.expire(sessionId);
                stripeResults.push({ sessionId, ok: true });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Unknown Stripe error";
                stripeResults.push({ sessionId, ok: false, error: msg });
            }
        }

        return NextResponse.json({
            ok: true,
            expiredCount: reservationIds.length,
            reservationIds,
            stripeExpiredCount: stripeResults.filter((r) => r.ok).length,
            stripeResults,
            now: now.toISOString(),
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
