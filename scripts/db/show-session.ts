import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { ReservationStatus } from "../../src/generated/prisma";

async function main() {
    const sessionId = process.argv[2];
    if (!sessionId) {
        console.log("Usage: npx tsx scripts/db/show-session.ts <sessionId>");
        process.exit(1);
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { experience: { select: { title: true, type: true } } },
    });

    if (!session) {
        console.log("Session not found:", sessionId);
        process.exit(1);
    }

    const taken = await prisma.reservation.count({
        where: {
            sessionId,
            status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
        },
    });

    const waiting = await prisma.reservation.count({
        where: { sessionId, status: ReservationStatus.WAITING },
    });

    console.log({
        sessionId: session.id,
        experience: session.experience.title,
        type: session.experience.type,
        startAt: session.startAt.toISOString(),
        bookingClosesAt: session.bookingClosesAt.toISOString(),
        maxSeatsTotal: session.maxSeatsTotal,
        maxPerGuide: session.maxPerGuide,
        requiresPayment: session.requiresPayment,
        priceCents: session.priceCents,
        currency: session.currency,
        cancelled: session.isCancelled,
        taken,
        waiting,
        seatsLeft: Math.max(session.maxSeatsTotal - taken, 0),
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
