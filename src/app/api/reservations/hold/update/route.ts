import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, LanguageBase } from "@/generated/prisma";

export const runtime = "nodejs";

type Body = {
    reservationId?: string;
    customerName?: string;
    customerPhone?: string | null;
    tourLanguage?: LanguageBase; // CA | ES | EN
};

export async function POST(req: Request) {
    const body = (await req.json()) as Body;

    const reservationId = body.reservationId?.trim();
    const customerName = body.customerName?.trim();
    const customerPhone = body.customerPhone?.trim() ?? null;
    const tourLanguage = body.tourLanguage;

    if (!reservationId) {
        return NextResponse.json({ ok: false, error: "reservationId is required" }, { status: 400 });
    }
    if (!customerName) {
        return NextResponse.json({ ok: false, error: "customerName is required" }, { status: 400 });
    }
    if (!tourLanguage) {
        return NextResponse.json({ ok: false, error: "tourLanguage is required" }, { status: 400 });
    }

    const now = new Date();

    const resv = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { customer: true },
    });

    if (!resv) {
        return NextResponse.json({ ok: false, error: "Reservation not found" }, { status: 404 });
    }

    if (
        resv.status !== ReservationStatus.HOLD ||
        !resv.holdExpiresAt ||
        resv.holdExpiresAt <= now
    ) {
        return NextResponse.json({ ok: false, error: "HOLD expired" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
        await tx.customer.update({
            where: { id: resv.customerId },
            data: {
                name: customerName,
                phone: customerPhone,
            },
        });

        await tx.reservation.update({
            where: { id: reservationId },
            data: {
                tourLanguage,
            },
        });
    });

    return NextResponse.json({ ok: true });
}
