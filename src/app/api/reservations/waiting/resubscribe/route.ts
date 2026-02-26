import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";

export const runtime = "nodejs";

type Body = {
    waitingId?: string;
};

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

    // Solo reactivamos si sigue en WAITING
    if (waiting.status !== ReservationStatus.WAITING) {
        return NextResponse.json({ ok: false, error: "Reservation is not WAITING" }, { status: 409 });
    }

    const now = new Date();

    if (waiting.session.isCancelled) {
        return NextResponse.json({ ok: false, error: "Session is cancelled" }, { status: 409 });
    }

    if (waiting.session.bookingClosesAt <= now) {
        return NextResponse.json({ ok: false, error: "Booking is closed for this session" }, { status: 409 });
    }

    // ✅ Reactivar elegibilidad para notify
    await prisma.reservation.update({
        where: { id: waitingId },
        data: { availabilityEmailSentAt: null },
    });

    return NextResponse.json({ ok: true });
}