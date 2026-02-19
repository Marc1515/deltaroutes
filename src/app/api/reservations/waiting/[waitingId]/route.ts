import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";

export const runtime = "nodejs";

type ParamsObj = { waitingId?: string };
type Ctx = { params: ParamsObj | Promise<ParamsObj> };

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasParams(value: unknown): value is Ctx {
    if (!isObject(value)) return false;
    return "params" in value;
}

async function getWaitingId(ctx: unknown): Promise<string | undefined> {
    if (!hasParams(ctx)) return undefined;

    const p = ctx.params;
    const params = p instanceof Promise ? await p : p;

    return typeof params.waitingId === "string" ? params.waitingId : undefined;
}

export async function GET(_req: Request, ctx: unknown) {
    const waitingId = await getWaitingId(ctx);

    if (!waitingId) {
        return NextResponse.json(
            { ok: false, error: "Missing waitingId param" },
            { status: 400 },
        );
    }

    const now = new Date();

    const waiting = await prisma.reservation.findUnique({
        where: { id: waitingId },
        include: {
            customer: true,
            session: { include: { experience: { select: { title: true } } } },
        },
    });

    if (!waiting) {
        return NextResponse.json(
            { ok: false, error: "Waiting reservation not found" },
            { status: 404 },
        );
    }

    if (waiting.status !== ReservationStatus.WAITING) {
        return NextResponse.json(
            { ok: false, error: "Reservation is not WAITING" },
            { status: 400 },
        );
    }

    const session = waiting.session;

    // Helpers para no repetir JSON
    const base = {
        ok: true as const,
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
        maxSeatsTotal: session.maxSeatsTotal,
    };

    if (session.isCancelled) {
        return NextResponse.json({
            ...base,
            canClaimNow: false,
            freeSeats: 0,
            isCancelled: true,
        });
    }

    if (now > session.bookingClosesAt) {
        return NextResponse.json({
            ...base,
            canClaimNow: false,
            freeSeats: 0,
            isCancelled: false,
        });
    }

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
        ...base,
        canClaimNow,
        freeSeats,
        isCancelled: false,
    });
}
