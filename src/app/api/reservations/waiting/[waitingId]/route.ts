import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";

export const runtime = "nodejs";

export async function GET(
    _req: Request,
    { params }: { params: { waitingId: string } }
) {
    const waitingId = params.waitingId;

    const now = new Date();

    const waiting = await prisma.reservation.findUnique({
        where: { id: waitingId },
        include: {
            customer: true,
            session: { include: { experience: { select: { title: true } } } },
        },
    });

    if (!waiting) {
        return NextResponse.json({ ok: false, error: "Waiting reservation not found" }, { status: 404 });
    }

    if (waiting.status !== ReservationStatus.WAITING) {
        return NextResponse.json({ ok: false, error: "Reservation is not WAITING" }, { status: 400 });
    }

    const session = waiting.session;

    if (session.isCancelled) {
        return NextResponse.json({
            ok: true,
            waitingId,
            sessionId: session.id,
            experienceTitle: session.experience.title,
            startAt: session.startAt.toISOString(),
            bookingClosesAt: session.bookingClosesAt.toISOString(),
            adultsCount: waiting.adultsCount,
            minorsCount: waiting.minorsCount,
            totalPax: waiting.totalPax,
            customerEmail: waiting.customer.email,
            customerName: waiting.customer.name ?? null,
            canClaimNow: false,
            freeSeats: 0,
            maxSeatsTotal: session.maxSeatsTotal,
            isCancelled: true,
        });
    }

    if (now > session.bookingClosesAt) {
        return NextResponse.json({
            ok: true,
            waitingId,
            sessionId: session.id,
            experienceTitle: session.experience.title,
            startAt: session.startAt.toISOString(),
            bookingClosesAt: session.bookingClosesAt.toISOString(),
            adultsCount: waiting.adultsCount,
            minorsCount: waiting.minorsCount,
            totalPax: waiting.totalPax,
            customerEmail: waiting.customer.email,
            customerName: waiting.customer.name ?? null,
            canClaimNow: false,
            freeSeats: 0,
            maxSeatsTotal: session.maxSeatsTotal,
            isCancelled: false,
        });
    }

    // freeSeats actual: CONFIRMED + HOLD activo
    const reservedAgg = await prisma.reservation.aggregate({
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
    const canClaimNow = freeSeats >= waiting.totalPax;

    return NextResponse.json({
        ok: true,
        waitingId,
        sessionId: session.id,
        experienceTitle: session.experience.title,
        startAt: session.startAt.toISOString(),
        bookingClosesAt: session.bookingClosesAt.toISOString(),
        adultsCount: waiting.adultsCount,
        minorsCount: waiting.minorsCount,
        totalPax: waiting.totalPax,
        customerEmail: waiting.customer.email,
        customerName: waiting.customer.name ?? null,
        canClaimNow,
        freeSeats,
        maxSeatsTotal: session.maxSeatsTotal,
        isCancelled: false,
    });
}
