import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

function addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function main() {
    const exp = await prisma.experience.findFirst({
        orderBy: { createdAt: "asc" },
    });

    if (!exp) throw new Error("No experiences found. Seed first.");

    const now = new Date();

    // mañana a las 11:00 (hora local)
    const startAt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        11, 0, 0, 0
    );

    const bookingClosesAt = addHours(startAt, -4);

    // Defaults de demo (ajústalos si quieres)
    const adultPriceCents = 5000;
    const minorPriceCents = 2500;

    const created = await prisma.session.create({
        data: {
            experienceId: exp.id,
            startAt,
            endAt: addHours(startAt, 2),
            meetingPoint: "Punto de encuentro (demo)",
            mapsUrl: null,
            maxSeatsTotal: 20,
            maxPerGuide: 6,
            bookingClosesAt,
            adultPriceCents,
            minorPriceCents,
            currency: "eur",
            requiresPayment: true,
            isCancelled: false,
        },
        include: { experience: true },
    });

    console.log({
        sessionId: created.id,
        experience: created.experience.title,
        startAt: created.startAt.toISOString(),
        bookingClosesAt: created.bookingClosesAt.toISOString(),
        adultPriceCents: created.adultPriceCents,
        minorPriceCents: created.minorPriceCents,
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
