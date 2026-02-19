import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, PaymentStatus } from "@/generated/prisma";
import { HOLD_MINUTES } from "@/config/app";

export const runtime = "nodejs";

type Body = {
    waitingId?: string;
};

type ClaimOk = { ok: true; reservationId: string; holdExpiresAt: string };
type ClaimErr = {
    ok: false;
    error: string;
    code?: "NO_SEATS" | "NOT_WAITING" | "CLOSED" | "CANCELLED" | "NO_GUIDE";
};

function addMinutes(d: Date, minutes: number) {
    return new Date(d.getTime() + minutes * 60_000);
}

function isSerializationError(e: unknown): boolean {
    if (!(e instanceof Error)) return false;
    const msg = e.message.toLowerCase();
    return msg.includes("serialization") || msg.includes("could not serialize");
}

async function attemptClaim(waitingId: string): Promise<ClaimOk | ClaimErr> {
    const now = new Date();
    const holdExpiresAt = addMinutes(now, HOLD_MINUTES);

    return prisma.$transaction(
        async (tx) => {
            const waiting = await tx.reservation.findUnique({
                where: { id: waitingId },
                include: {
                    session: true,
                    customer: true,
                },
            });

            if (!waiting) {
                return { ok: false, code: "NOT_WAITING", error: "Reservation not found" };
            }

            // ✅ desde aquí solo usamos `w` (no-null)
            const w = waiting;

            if (w.status !== ReservationStatus.WAITING) {
                return { ok: false, code: "NOT_WAITING", error: "Reservation is not WAITING" };
            }

            const session = w.session;

            if (session.isCancelled) {
                return { ok: false, code: "CANCELLED", error: "Session is cancelled" };
            }

            if (now > session.bookingClosesAt) {
                return { ok: false, code: "CLOSED", error: "Booking is closed for this session" };
            }

            // 1) plazas libres (CONFIRMED + HOLD activo)
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

            if (freeSeats < w.totalPax) {
                return { ok: false, code: "NO_SEATS", error: "Not enough free seats right now" };
            }

            // 2) guía: sin depender de tourLanguage (aún no existe)
            const candidateGuides = await tx.user.findMany({
                where: { role: "GUIDE", isActive: true },
                select: { id: true },
            });

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

                const chosen = sorted.find((g) => g.load + w.totalPax <= session.maxPerGuide);
                return chosen?.id ?? null;
            }

            const guideUserId = await pickLeastLoaded(candidateGuides.map((g) => g.id));
            if (!guideUserId) {
                return { ok: false, code: "NO_GUIDE", error: "No guide capacity right now" };
            }

            // 3) UPDATE condicionado
            const updated = await tx.reservation.updateMany({
                where: { id: w.id, status: ReservationStatus.WAITING },
                data: {
                    status: ReservationStatus.HOLD,
                    holdExpiresAt,
                    guideUserId,
                },
            });

            if (updated.count !== 1) {
                return { ok: false, code: "NO_SEATS", error: "Race lost" };
            }

            // 4) Payment
            const amountCents = w.adultsCount * session.adultPriceCents + w.minorsCount * session.minorPriceCents;

            if (session.requiresPayment) {
                await tx.payment.upsert({
                    where: { reservationId: w.id },
                    update: {
                        status: PaymentStatus.REQUIRES_PAYMENT,
                        amountCents,
                        currency: session.currency,
                        stripeCheckoutSessionId: null,
                        stripePaymentIntentId: null,
                    },
                    create: {
                        reservationId: w.id,
                        status: PaymentStatus.REQUIRES_PAYMENT,
                        amountCents,
                        currency: session.currency,
                    },
                });
            } else {
                await tx.payment.upsert({
                    where: { reservationId: w.id },
                    update: {
                        status: PaymentStatus.NOT_REQUIRED,
                        amountCents: 0,
                        currency: session.currency,
                        stripeCheckoutSessionId: null,
                        stripePaymentIntentId: null,
                    },
                    create: {
                        reservationId: w.id,
                        status: PaymentStatus.NOT_REQUIRED,
                        amountCents: 0,
                        currency: session.currency,
                    },
                });
            }

            return { ok: true, reservationId: w.id, holdExpiresAt: holdExpiresAt.toISOString() };
        },
        { isolationLevel: "Serializable" },
    );
}

export async function POST(req: Request) {
    const body = (await req.json()) as Body;

    const waitingId = body.waitingId?.trim();
    if (!waitingId) {
        return NextResponse.json({ ok: false, error: "waitingId is required" }, { status: 400 });
    }

    for (let i = 0; i < 3; i++) {
        try {
            const result = await attemptClaim(waitingId);
            const status = result.ok ? 200 : 409;
            return NextResponse.json(result, { status });
        } catch (e: unknown) {
            if (isSerializationError(e) && i < 2) continue;
            const msg = e instanceof Error ? e.message : "Unknown error";
            return NextResponse.json({ ok: false, error: msg }, { status: 500 });
        }
    }

    return NextResponse.json({ ok: false, error: "Could not claim" }, { status: 409 });
}
