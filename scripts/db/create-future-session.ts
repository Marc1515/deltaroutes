// scripts/db/create-future-session.ts
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

    // Mañana a las 11:00 (hora local del sistema)
    const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0, 0, 0);
    const bookingClosesAt = addHours(startAt, -4);

    // Precios demo (ajusta a lo que uses en tu negocio)
    const adultPriceCents = 5000; // 50€
    const minorPriceCents = 2500; // 25€

    const created = await prisma.session.create({
        data: {
            experienceId: exp.id,
            startAt,
            endAt: addHours(startAt, 2),
            meetingPoint: "Punto de encuentro (demo)",
            mapsUrl: null,

            // Capacidad
            maxSeatsTotal: 20,
            maxPerGuide: 6,

            // Cierre de reservas
            bookingClosesAt,

            // Precio por pax
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
