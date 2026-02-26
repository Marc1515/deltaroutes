import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";

export const runtime = "nodejs";

type Body = { waitingId?: string };

export async function POST(req: Request) {
    const body = (await req.json()) as Body;
    const waitingId = body.waitingId?.trim();

    if (!waitingId) {
        return NextResponse.json({ ok: false, error: "waitingId is required" }, { status: 400 });
    }

    const waiting = await prisma.reservation.findUnique({
        where: { id: waitingId },
        include: { session: true },
    });

    if (!waiting) {
        return NextResponse.json({ ok: false, error: "Reservation not found" }, { status: 404 });
    }

    // Solo permitimos rearmar si sigue siendo WAITING
    if (waiting.status !== ReservationStatus.WAITING) {
        return NextResponse.json(
            { ok: false, error: "Reservation is not WAITING" },
            { status: 409 },
        );
    }

    // Si la sesión ya cerró, no tiene sentido resuscribir
    const now = new Date();
    if (waiting.session.isCancelled || waiting.session.bookingClosesAt <= now) {
        return NextResponse.json(
            { ok: false, error: "Session is closed or cancelled" },
            { status: 409 },
        );
    }

    // ✅ Rearmamos: vuelve a ser elegible para notify
    await prisma.reservation.update({
        where: { id: waitingId },
        data: {
            availabilityEmailSentAt: null,
        },
    });

    return NextResponse.json({ ok: true });
}