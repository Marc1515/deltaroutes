import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
    const sessions = await prisma.session.findMany({
        take: 20,
        orderBy: { startAt: "asc" },
        include: { experience: { select: { title: true, type: true } } },
    });

    console.table(
        sessions.map((s) => ({
            id: s.id,
            experience: s.experience.title,
            type: s.experience.type,
            startAt: s.startAt.toISOString(),
            bookingClosesAt: s.bookingClosesAt.toISOString(),
            maxSeatsTotal: s.maxSeatsTotal,
            maxPerGuide: s.maxPerGuide,
            priceCents: s.priceCents,
            requiresPayment: s.requiresPayment,
            currency: s.currency,
            cancelled: s.isCancelled,
        }))
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
