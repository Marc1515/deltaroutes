import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";
import { sendEmail } from "@/lib/email";
import ReservationWaitingEmail from "@/emails/ReservationWaitingEmail";

export const runtime = "nodejs";

const madridFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
});

type Body = {
    sessionId: string;
    customerEmail: string;
    adultsCount: number;
    minorsCount: number;
};

function safeNumber(n: unknown): number {
    const x = typeof n === "string" ? Number(n) : (n as number);
    return Number.isFinite(x) ? x : NaN;
}

export async function POST(req: Request) {
    const body = (await req.json()) as Partial<Body>;

    const sessionId = body.sessionId?.trim();
    const customerEmail = body.customerEmail?.trim().toLowerCase();

    const adultsCount = safeNumber(body.adultsCount);
    const minorsCount = safeNumber(body.minorsCount);

    if (!sessionId) {
        return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }
    if (!customerEmail) {
        return NextResponse.json({ ok: false, error: "customerEmail is required" }, { status: 400 });
    }
    if (!Number.isFinite(adultsCount) || adultsCount < 1) {
        return NextResponse.json({ ok: false, error: "adultsCount must be >= 1" }, { status: 400 });
    }
    if (!Number.isFinite(minorsCount) || minorsCount < 0) {
        return NextResponse.json({ ok: false, error: "minorsCount must be >= 0" }, { status: 400 });
    }

    const totalPax = adultsCount + minorsCount;

    // Creamos/obtenemos customer + creamos/reutilizamos WAITING
    const txResult = await prisma.$transaction(async (tx) => {
        const session = await tx.session.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                startAt: true,
                bookingClosesAt: true,
                isCancelled: true,
                experience: { select: { title: true, type: true } },
            },
        });

        if (!session || session.isCancelled) {
            return { ok: false as const, code: "SESSION_NOT_FOUND" as const };
        }

        const now = new Date();
        if (session.bookingClosesAt <= now) {
            return { ok: false as const, code: "BOOKING_CLOSED" as const };
        }

        const customer = await tx.customer.upsert({
            where: { email: customerEmail },
            update: {},
            create: { email: customerEmail },
            select: { id: true, email: true, name: true },
        });

        // Si ya existe reserva en esa sesión para ese customer, devolvemos la existente
        const existing = await tx.reservation.findUnique({
            where: { sessionId_customerId: { sessionId, customerId: customer.id } },
            select: { id: true, status: true },
        });

        if (existing) {
            return {
                ok: true as const,
                reservationId: existing.id,
                status: existing.status,
                isNew: false,
                customer,
                session,
            };
        }

        const reservation = await tx.reservation.create({
            data: {
                sessionId,
                customerId: customer.id,
                status: ReservationStatus.WAITING,
                holdExpiresAt: null,
                adultsCount,
                minorsCount,
                totalPax,
                // tourLanguage: null (se elige más tarde)
            },
            select: { id: true, status: true },
        });

        return {
            ok: true as const,
            reservationId: reservation.id,
            status: reservation.status,
            isNew: true,
            customer,
            session,
        };
    });

    if (!txResult.ok) {
        const status = txResult.code === "BOOKING_CLOSED" ? 400 : 404;
        return NextResponse.json({ ok: false, error: txResult.code }, { status });
    }

    // Email #1 (confirmación waitlist) idempotente
    try {
        const mark = await prisma.reservation.updateMany({
            where: {
                id: txResult.reservationId,
                createdEmailSentAt: { equals: null },
            },
            data: {
                createdEmailSentAt: new Date(),
                createdEmailKind: "WAITING",
            },
        });

        if (mark.count === 1) {
            const reservationCode = `DR-${txResult.reservationId.slice(0, 8).toUpperCase()}`;

            const activityLabel = txResult.session.experience.title;
            const startText = madridFormatter.format(txResult.session.startAt);


            void sendEmail({
                to: txResult.customer.email,
                subject: `DeltaRoutes · Lista de espera (${reservationCode})`,
                react: ReservationWaitingEmail({
                    customerName: txResult.customer.name ?? "Cliente",
                    activityLabel,
                    startText,
                    reservationCode,
                    adultsCount,
                    minorsCount,
                    totalPax,
                }),
            }).catch((e) => console.warn("[reservations/waiting] email failed:", e));
        }
    } catch (e) {
        console.warn("[reservations/waiting] email prep failed:", e);
    }

    return NextResponse.json({
        ok: true,
        reservationId: txResult.reservationId,
        status: txResult.status,
        totalPax,
    });
}
