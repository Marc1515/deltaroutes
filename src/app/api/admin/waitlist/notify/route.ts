// src/app/api/admin/waitlist/notify/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus } from "@/generated/prisma";
import { sendEmail } from "@/lib/email";
import ReservationAvailabilityEmail from "@/emails/ReservationAvailabilityEmail";

export const runtime = "nodejs";

const madridFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
});

export async function POST(req: Request) {
    const adminSecret = process.env.ADMIN_WAITLIST_SECRET;
    const headerSecret = req.headers.get("x-admin-secret");

    if (!adminSecret) {
        return NextResponse.json(
            { ok: false, error: "Missing ADMIN_WAITLIST_SECRET" },
            { status: 500 }
        );
    }

    if (headerSecret !== adminSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    /**
     * 1) Sesiones futuras/no canceladas que:
     * - todavía permiten reservar (bookingClosesAt > now)
     * - tienen WAITING pendientes a los que aún no se les avisó
     */
    const sessions = await prisma.session.findMany({
        where: {
            isCancelled: false,
            startAt: { gt: now },
            bookingClosesAt: { gt: now },
            reservations: {
                some: {
                    status: ReservationStatus.WAITING,
                    availabilityEmailSentAt: null,
                },
            },
        },
        select: {
            id: true,
            startAt: true,
            bookingClosesAt: true,
            maxSeatsTotal: true,
            experience: { select: { title: true } },
        },
        orderBy: { startAt: "asc" },
    });

    let notified = 0;
    let considered = 0;

    for (const session of sessions) {
        /**
         * 2) Plazas ocupadas reales:
         * - CONFIRMED
         * - HOLD activo (holdExpiresAt > now)
         */
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
        let freeSeats = Math.max(0, session.maxSeatsTotal - reservedSeats);

        if (freeSeats <= 0) continue;

        /**
         * 3) WAITING pendientes en orden de llegada.
         * Avisamos a los que "quepan" en las plazas libres actuales.
         */
        const waiting = await prisma.reservation.findMany({
            where: {
                sessionId: session.id,
                status: ReservationStatus.WAITING,
                availabilityEmailSentAt: null,
            },
            include: { customer: true },
            orderBy: { createdAt: "asc" },
            take: 50,
        });

        for (const r of waiting) {
            considered++;

            // Si todavía no caben, pasamos al siguiente (más pequeño podría caber)
            if (freeSeats < r.totalPax) continue;

            // Marcamos primero para idempotencia (si llamas 2 veces notify)
            const mark = await prisma.reservation.updateMany({
                where: { id: r.id, availabilityEmailSentAt: { equals: null } },
                data: { availabilityEmailSentAt: new Date() },
            });

            if (mark.count !== 1) continue;

            const toEmail = r.customer.email;
            if (!toEmail) {
                // Si algún día permites customer.email nullable, evitamos crash y seguimos.
                continue;
            }

            const reservationCode = `DR-${r.id.slice(0, 8).toUpperCase()}`;
            const activityLabel = session.experience.title;
            const startText = madridFormatter.format(session.startAt);

            /**
             * Link hacia tu UI (/book).
             * Importante:
             * - NO convertimos a HOLD al abrir el link (evita previews/bots consumiendo plazas).
             * - La UI mostrará un CTA "Reservar ahora" y entonces llamará a una API para
             *   convertir WAITING -> HOLD de forma controlada.
             *
             * Por eso el identificador real es waitingId.
             */
            const actionUrl = `${appUrl}/book?waitingId=${encodeURIComponent(r.id)}`;


            await sendEmail({
                to: toEmail,
                subject: `DeltaRoutes · Ya hay plazas (${reservationCode})`,
                react: ReservationAvailabilityEmail({
                    customerName: r.customer.name ?? "Cliente",
                    activityLabel,
                    startText,
                    reservationCode,
                    adultsCount: r.adultsCount,
                    minorsCount: r.minorsCount,
                    totalPax: r.totalPax,
                    actionUrl,
                }),
            });

            notified++;
            freeSeats -= r.totalPax;

            // No avisamos a más gente de la que cabe ahora mismo
            if (freeSeats <= 0) break;
        }
    }

    return NextResponse.json({
        ok: true,
        sessionsChecked: sessions.length,
        considered,
        notified,
    });
}
