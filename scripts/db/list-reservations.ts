import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { ReservationStatus } from "../../src/generated/prisma";

async function main() {
    const reservations = await prisma.reservation.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
            customer: { select: { name: true, email: true } },
            session: { select: { startAt: true } },
            guideUser: { select: { name: true, email: true } },
            payment: { select: { status: true, amountCents: true, currency: true } },
        },
    });

    console.table(
        reservations.map((r) => ({
            id: r.id,
            status: r.status,
            tourLanguage: r.tourLanguage,
            browserLanguage: r.browserLanguage ?? "",
            startAt: r.session.startAt.toISOString(),
            customer: r.customer.email ?? r.customer.name,
            guide: r.guideUser?.email ?? "",
            paymentStatus: r.payment?.status ?? "",
            amountCents: r.payment?.amountCents ?? "",
            currency: r.payment?.currency ?? "",
            holdExpiresAt: r.holdExpiresAt ? r.holdExpiresAt.toISOString() : "",
            createdAt: r.createdAt.toISOString(),
        }))
    );

    const holds = await prisma.reservation.count({ where: { status: ReservationStatus.HOLD } });
    const waiting = await prisma.reservation.count({ where: { status: ReservationStatus.WAITING } });
    const confirmed = await prisma.reservation.count({ where: { status: ReservationStatus.CONFIRMED } });

    console.log({ holds, waiting, confirmed });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
