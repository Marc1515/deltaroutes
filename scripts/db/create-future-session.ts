import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

function addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

async function main() {
    const exp = await prisma.experience.findFirst({
        orderBy: { createdAt: "asc" },
    });

    if (!exp) throw new Error("No experiences found. Seed first.");

    const now = new Date();

    // Base: mañana a las 11:00 (hora local)
    const baseStartAt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        11,
        0,
        0,
        0,
    );

    // ✅ Para que SIEMPRE sea único:
    // añadimos un offset de minutos (0..59) según el minuto actual,
    // y además lo forzamos a un múltiplo de 5 para que quede “bonito”
    const offset = Math.floor(now.getMinutes() / 5) * 5;
    const startAt = addMinutes(baseStartAt, offset);

    const bookingClosesAt = addHours(startAt, -4);

    // Defaults de demo
    const adultPriceCents = 5000;
    const minorPriceCents = 2500;

    // Defaults para tests
    const maxSeatsTotal = 5;
    const maxPerGuide = 6;

    const created = await prisma.session.create({
        data: {
            experienceId: exp.id,
            startAt,
            endAt: addHours(startAt, 2),
            meetingPoint: "Punto de encuentro (demo)",
            mapsUrl: null,
            maxSeatsTotal,
            maxPerGuide,
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
        maxSeatsTotal: created.maxSeatsTotal,
        maxPerGuide: created.maxPerGuide,
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());