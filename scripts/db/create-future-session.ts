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

    // ✅ Unicidad fuerte:
    // - offset aleatorio en minutos (0..719 => hasta +12h)
    // - segundos aleatorios (0..59) para evitar colisiones incluso si se repite el minuto
    const offsetMinutes = Math.floor(Math.random() * 720);
    const offsetSeconds = Math.floor(Math.random() * 60);

    const startAt = addMinutes(baseStartAt, offsetMinutes);
    startAt.setSeconds(offsetSeconds, 0);

    const bookingClosesAt = addHours(startAt, -4);

    const adultPriceCents = 5000;
    const minorPriceCents = 2500;

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