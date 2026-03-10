import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

type SessionCreateDataWithName = Parameters<
    typeof prisma.session.create
>[0]["data"] & { name?: string };

const SESSION_NAME_WORDS = [
    "arrozales",
    "miradores",
    "delta",
    "rio",
    "atardecer",
    "amanecer",
    "fauna",
    "naturaleza",
    "senderos",
    "crucero",
    "kayak",
    "bicicleta",
    "familias",
    "aventura",
    "tranquilo",
    "panoramicas",
    "playas",
    "estuario",
    "lagunas",
    "puesta",
    "sol",
    "rioEbro",
];

function randomSessionName() {
    const wordsCount = 4 + Math.floor(Math.random() * 5); // 4..8
    const words: string[] = [];
    for (let i = 0; i < wordsCount; i++) {
        const index = Math.floor(Math.random() * SESSION_NAME_WORDS.length);
        words.push(SESSION_NAME_WORDS[index]);
    }
    const raw = words.join(" ");
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

async function main() {
    const experiences = await prisma.experience.findMany();

    if (!experiences.length) throw new Error("No experiences found. Seed first.");

    const now = new Date();

    const adultPriceCents = 5000;
    const minorPriceCents = 2500;

    const maxSeatsTotal = 5;
    const maxPerGuide = 6;

    for (const exp of experiences) {
        // Para cada experiencia, creamos 2 sesiones futuras:
        // - Una para mañana (+1 día)
        // - Otra para dentro de 5 días (+5 días)
        for (const daysFromNow of [1, 5]) {
            // Base: día correspondiente a las 11:00 (hora local)
            const baseStartAt = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + daysFromNow,
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

            const data: SessionCreateDataWithName = {
                experienceId: exp.id,
                name: randomSessionName(),
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
            };

            const created = await prisma.session.create({
                data,
                include: { experience: true },
            });

            console.log({
                sessionId: created.id,
                experience: created.experience.title,
                daysFromNow,
                startAt: created.startAt.toISOString(),
                bookingClosesAt: created.bookingClosesAt.toISOString(),
                adultPriceCents: created.adultPriceCents,
                minorPriceCents: created.minorPriceCents,
                maxSeatsTotal: created.maxSeatsTotal,
                maxPerGuide: created.maxPerGuide,
            });
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());