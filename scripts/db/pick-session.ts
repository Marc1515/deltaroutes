// scripts/db/pick-session.ts
import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
    const now = new Date();

    // Busca la primera sesión que:
    // - no esté cancelada
    // - y cuyo bookingClosesAt esté en el futuro
    const session = await prisma.session.findFirst({
        where: {
            isCancelled: false,
            bookingClosesAt: { gt: now },
        },
        orderBy: { startAt: "asc" },
        include: {
            experience: { select: { title: true, type: true } },
        },
    });

    if (!session) {
        console.log("No reservable session found (all bookingClosesAt are in the past).");
        return;
    }

    console.log({
        sessionId: session.id,
        experience: session.experience.title,
        type: session.experience.type,
        startAt: session.startAt.toISOString(),
        bookingClosesAt: session.bookingClosesAt.toISOString(),
        maxSeatsTotal: session.maxSeatsTotal,
        maxPerGuide: session.maxPerGuide,
        priceCents: session.priceCents,
        requiresPayment: session.requiresPayment,
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
