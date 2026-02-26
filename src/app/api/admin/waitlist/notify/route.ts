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

type Body = { sessionId?: string };

export async function POST(req: Request) {
    const adminSecret = process.env.ADMIN_WAITLIST_SECRET;
    const headerSecret = req.headers.get("x-admin-secret");

    if (!adminSecret) {
        return NextResponse.json(
            { ok: false, error: "Missing ADMIN_WAITLIST_SECRET" },
            { status: 500 },
        );
    }

    if (headerSecret !== adminSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const filterSessionId = body.sessionId?.trim();

    const now = new Date();
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const sessions = await prisma.session.findMany({
        where: {
            ...(filterSessionId ? { id: filterSessionId } : {}),
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

    // Debug opcional
    const sent: Array<{ waitingId: string; to: string; actionUrl: string; sessionId: string }> = [];

    for (const session of sessions) {
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

            const mark = await prisma.reservation.updateMany({
                where: { id: r.id, availabilityEmailSentAt: { equals: null } },
                data: { availabilityEmailSentAt: new Date() },
            });

            if (mark.count !== 1) continue;

            const toEmail = r.customer.email;
            if (!toEmail) continue;

            const reservationCode = `DR-${r.id.slice(0, 8).toUpperCase()}`;
            const activityLabel = session.experience.title;
            const startText = madridFormatter.format(session.startAt);
            const actionUrl = `${appUrl}/book?waitingId=${encodeURIComponent(r.id)}`;

            try {
                await sendEmail({
                    to: toEmail,
                    subject: `DeltaRoutes: acción requerida (${reservationCode})`,
                    replyTo: process.env.EMAIL_REPLY_TO,
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

                sent.push({ waitingId: r.id, to: toEmail, actionUrl, sessionId: session.id });

                notified++;
                freeSeats -= r.totalPax;

                if (freeSeats <= 0) break;
            } catch (e) {
                console.warn("[waitlist/notify] sendEmail failed:", e);
                // revertimos para reintentar
                await prisma.reservation.update({
                    where: { id: r.id },
                    data: { availabilityEmailSentAt: null },
                });
            }
        }
    }

    return NextResponse.json({
        ok: true,
        sessionsChecked: sessions.length,
        considered,
        notified,
        sent,
    });
}