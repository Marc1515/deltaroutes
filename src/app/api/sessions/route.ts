import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";

export const runtime = "nodejs";

type SessionAvailability = {
    id: string;
    experienceId: string;
    startAt: string;
    bookingClosesAt: string;
    maxSeatsTotal: number;
    reservedSeats: number;
    freeSeats: number;
    canFit: boolean;
    isCancelled: boolean;
};

export async function GET(req: Request) {
    const url = new URL(req.url);

    const experienceId = url.searchParams.get("experienceId");
    const paxParam = url.searchParams.get("pax");

    if (!experienceId) {
        return NextResponse.json({ ok: false, error: "experienceId is required" }, { status: 400 });
    }

    const pax = paxParam ? Number(paxParam) : 1;
    if (!Number.isFinite(pax) || pax < 1) {
        return NextResponse.json({ ok: false, error: "pax must be a number >= 1" }, { status: 400 });
    }

    const now = new Date();

    // Traemos sesiones futuras publicables (no canceladas, no pasadas, no cerradas)
    // Nota: si quieres mostrar también las que ya han cerrado reservas, quita bookingClosesAt filter.
    const sessions = await prisma.session.findMany({
        where: {
            experienceId,
            isCancelled: false,
            startAt: { gt: now },
            bookingClosesAt: { gt: now },
        },
        orderBy: { startAt: "asc" },
        select: {
            id: true,
            experienceId: true,
            startAt: true,
            bookingClosesAt: true,
            maxSeatsTotal: true,
            isCancelled: true,
        },
    });

    if (sessions.length === 0) {
        return NextResponse.json({ ok: true, sessions: [] satisfies SessionAvailability[] });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Calculamos plazas ocupadas:
    // - CONFIRMED siempre cuenta
    // - HOLD cuenta solo si holdExpiresAt > now
    //
    // Usamos groupBy para sumar totalPax por sessionId.
    const grouped = await prisma.reservation.groupBy({
        by: ["sessionId"],
        where: {
            sessionId: { in: sessionIds },
            OR: [
                { status: ReservationStatus.CONFIRMED },
                { status: ReservationStatus.HOLD, holdExpiresAt: { gt: now } },
            ],
        },
        _sum: { totalPax: true },
    });

    const reservedBySession = new Map<string, number>();
    for (const row of grouped) {
        reservedBySession.set(row.sessionId, row._sum.totalPax ?? 0);
    }

    const result: SessionAvailability[] = sessions.map((s) => {
        const reservedSeats = reservedBySession.get(s.id) ?? 0;
        const freeSeats = Math.max(0, s.maxSeatsTotal - reservedSeats);

        return {
            id: s.id,
            experienceId: s.experienceId,
            startAt: s.startAt.toISOString(),
            bookingClosesAt: s.bookingClosesAt.toISOString(),
            maxSeatsTotal: s.maxSeatsTotal,
            reservedSeats,
            freeSeats,
            canFit: freeSeats >= pax,
            isCancelled: s.isCancelled,
        };
    });

    return NextResponse.json({ ok: true, pax, sessions: result });
}
