import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    ReservationStatus,
    PaymentStatus,
    LanguageBase,
    LanguageCode,
} from "@/generated/prisma";
import { HOLD_MINUTES } from "@/config/app";

export const runtime = "nodejs";

type Body = {
    waitingId: string;
    customerName: string;
    customerPhone?: string | null;
    tourLanguage: LanguageBase; // CA | ES | EN
};

function isBaseLanguage(lng: LanguageCode) {
    return lng === LanguageCode.CA || lng === LanguageCode.ES || lng === LanguageCode.EN;
}

export async function POST(req: Request) {
    const body = (await req.json()) as Body;

    if (!body.waitingId || !body.customerName || !body.tourLanguage) {
        return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date();

    try {
        const result = await prisma.$transaction(async (tx) => {
            const waiting = await tx.reservation.findUniqueOrThrow({
                where: { id: body.waitingId },
                include: {
                    customer: true,
                    session: true,
                },
            });

            if (waiting.status !== ReservationStatus.WAITING) {
                return { ok: false as const, status: 400, error: "Reservation is not WAITING" };
            }

            const session = waiting.session;

            if (session.isCancelled) {
                return { ok: false as const, status: 400, error: "Session is cancelled" };
            }

            if (now > session.bookingClosesAt) {
                return { ok: false as const, status: 400, error: "Booking is closed for this session" };
            }

            // Recalcular plazas libres (CONFIRMED + HOLD activo)
            const reservedAgg = await tx.reservation.aggregate({
                where: {
                    sessionId: session.id,
                    OR: [
                        { status: ReservationStatus.CONFIRMED },
                        { status: ReservationStatus.HOLD, holdExpiresAt: { gt: now } },
                    ],
                },
                _sum: { totalPax: true },
            });

            const reservedSeats = reservedAgg._sum.totalPax ?? 0;
            const freeSeats = Math.max(0, session.maxSeatsTotal - reservedSeats);

            if (freeSeats < waiting.totalPax) {
                return { ok: false as const, status: 409, error: "Not enough free seats right now" };
            }

            // Actualizar customer info (nombre/teléfono) al reclamar
            await tx.customer.update({
                where: { id: waiting.customerId },
                data: {
                    name: body.customerName,
                    phone: body.customerPhone ?? undefined,
                },
            });

            // Asignación de guía (misma lógica que ya usas, por carga en pax)
            const candidateGuides = await tx.user.findMany({
                where: { role: "GUIDE", isActive: true },
                select: { id: true, languages: true },
            });

            const browserLanguage = waiting.browserLanguage;

            const preferredGuides =
                browserLanguage && !isBaseLanguage(browserLanguage)
                    ? candidateGuides.filter((g) => g.languages.includes(browserLanguage))
                    : [];

            async function pickLeastLoaded(guideIds: string[]): Promise<string | null> {
                if (guideIds.length === 0) return null;

                const loads = await tx.reservation.groupBy({
                    by: ["guideUserId"],
                    where: {
                        sessionId: session.id,
                        OR: [
                            { status: ReservationStatus.CONFIRMED },
                            { status: ReservationStatus.HOLD, holdExpiresAt: { gt: now } },
                        ],
                        guideUserId: { in: guideIds },
                    },
                    _sum: { totalPax: true },
                });

                const loadMap = new Map<string, number>();
                for (const row of loads) {
                    if (row.guideUserId) loadMap.set(row.guideUserId, row._sum.totalPax ?? 0);
                }

                const sorted = guideIds
                    .map((id) => ({ id, load: loadMap.get(id) ?? 0 }))
                    .sort((a, b) => a.load - b.load);

                const chosen = sorted.find((g) => g.load + waiting.totalPax <= session.maxPerGuide);
                return chosen?.id ?? null;
            }

            let guideUserId: string | null = await pickLeastLoaded(preferredGuides.map((g) => g.id));
            if (!guideUserId) guideUserId = await pickLeastLoaded(candidateGuides.map((g) => g.id));

            if (!guideUserId) {
                return { ok: false as const, status: 409, error: "No guide available right now" };
            }

            const holdExpiresAt = new Date(now.getTime() + (HOLD_MINUTES + 1) * 60 * 1000);

            // Convertimos WAITING -> HOLD
            await tx.reservation.update({
                where: { id: waiting.id },
                data: {
                    status: ReservationStatus.HOLD,
                    holdExpiresAt,
                    guideUserId,
                    tourLanguage: body.tourLanguage,
                },
            });

            // Payment (monto por pax * precios sesión)
            const amountCents =
                waiting.adultsCount * session.adultPriceCents +
                waiting.minorsCount * session.minorPriceCents;

            if (session.requiresPayment) {
                await tx.payment.upsert({
                    where: { reservationId: waiting.id },
                    update: {
                        status: PaymentStatus.REQUIRES_PAYMENT,
                        amountCents,
                        currency: session.currency,
                        stripeCheckoutSessionId: null,
                        stripePaymentIntentId: null,
                    },
                    create: {
                        reservationId: waiting.id,
                        status: PaymentStatus.REQUIRES_PAYMENT,
                        amountCents,
                        currency: session.currency,
                    },
                });
            } else {
                await tx.payment.upsert({
                    where: { reservationId: waiting.id },
                    update: {
                        status: PaymentStatus.NOT_REQUIRED,
                        amountCents: 0,
                        currency: session.currency,
                        stripeCheckoutSessionId: null,
                        stripePaymentIntentId: null,
                    },
                    create: {
                        reservationId: waiting.id,
                        status: PaymentStatus.NOT_REQUIRED,
                        amountCents: 0,
                        currency: session.currency,
                    },
                });
            }

            return {
                ok: true as const,
                reservationId: waiting.id,
                holdExpiresAt: holdExpiresAt.toISOString(),
            };
        });

        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
        }

        return NextResponse.json(result);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
