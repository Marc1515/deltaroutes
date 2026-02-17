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
        return NextResponse.json({ ok: false, error: "Missing ADMIN_WAITLIST_SECRET" }, { status: 500 });
    }
    if (headerSecret !== adminSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    // 1) Candidatas: sesiones futuras y no canceladas que tengan WAITING pendientes
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
        // 2) Calcula plazas ocupadas (CONFIRMED + HOLD activo)
        const grouped = await prisma.reservation.groupBy({
            by: ["sessionId"],
            where: {
                sessionId: session.id,
                OR: [
                    { status: ReservationStatus.CONFIRMED },
                    { status: ReservationStatus.HOLD, holdExpiresAt: { gt: now } },
                ],
            },
            _sum: { totalPax: true },
        });

        const reservedSeats = grouped[0]?._sum.totalPax ?? 0;
        let freeSeats = Math.max(0, session.maxSeatsTotal - reservedSeats);

        if (freeSeats <= 0) continue;

        // 3) Coge WAITING pendientes por orden de llegada
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

            if (freeSeats < r.totalPax) continue;

            // Marcamos primero para evitar duplicados si llamas 2 veces al endpoint
            const mark = await prisma.reservation.updateMany({
                where: { id: r.id, availabilityEmailSentAt: { equals: null } },
                data: { availabilityEmailSentAt: new Date() },
            });

            if (mark.count !== 1) continue;

            const reservationCode = `DR-${r.id.slice(0, 8).toUpperCase()}`;
            const activityLabel = session.experience.title;
            const startText = madridFormatter.format(session.startAt);

            // Link para volver al flujo (ajústalo a tu ruta real de UI)
            // Aquí la idea es prellenar sesión + pax. Usa query params o tu state manager.
            const actionUrl =
                `${appUrl}/book?sessionId=${encodeURIComponent(session.id)}` +
                `&adults=${r.adultsCount}&minors=${r.minorsCount}`;

            await sendEmail({
                to: r.customer.email,
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
            freeSeats -= r.totalPax; // “reservamos” virtualmente prioridad para no avisar a más gente de la que cabe
            if (freeSeats <= 0) break;
        }
    }

    return NextResponse.json({ ok: true, sessionsChecked: sessions.length, considered, notified });
}
