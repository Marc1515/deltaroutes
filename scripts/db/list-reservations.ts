import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

const madridFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "short",
    timeStyle: "short",
});


async function main() {
    const reservations = await prisma.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
            customer: { select: { name: true, email: true } },
            session: { select: { startAt: true } },
            guideUser: { select: { email: true } },
            payment: { select: { status: true, amountCents: true, currency: true } },
        },
    });

    console.log("reservations found:", reservations.length);

    const mapped = reservations.map((r) => ({
        id: r.id,
        status: r.status,
        tourLanguage: r.tourLanguage,
        browserLanguage: r.browserLanguage ?? null,
        customerEmail: r.customer.email ?? null,
        guideEmail: r.guideUser?.email ?? null,
        paymentStatus: r.payment?.status ?? null,
        amountCents: r.payment?.amountCents ?? null,
        currency: r.payment?.currency ?? null,
        holdExpiresAtUtc: r.holdExpiresAt ? r.holdExpiresAt.toISOString() : null,
        holdExpiresAtLocal: r.holdExpiresAt ? madridFormatter.format(r.holdExpiresAt) : null,
        createdAtUtc: r.createdAt.toISOString(),
        createdAtLocal: madridFormatter.format(r.createdAt),

        sessionStartAt: r.session.startAt.toISOString(),
    }));

    console.log(JSON.stringify(mapped, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
