import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { ReservationStatus, PaymentStatus } from "../../src/generated/prisma";

async function main() {
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
        const expiredHolds = await tx.reservation.findMany({
            where: {
                status: ReservationStatus.HOLD,
                holdExpiresAt: { not: null, lt: now },
            },
            select: { id: true },
        });

        if (expiredHolds.length === 0) {
            return { expiredCount: 0, reservationIds: [] as string[] };
        }

        const ids = expiredHolds.map((r) => r.id);

        await tx.reservation.updateMany({
            where: { id: { in: ids } },
            data: {
                status: ReservationStatus.EXPIRED,
                holdExpiresAt: null,
            },
        });

        await tx.payment.updateMany({
            where: {
                reservationId: { in: ids },
                status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT] },
            },
            data: { status: PaymentStatus.CANCELED },
        });

        return { expiredCount: ids.length, reservationIds: ids };
    });

    console.log({
        ok: true,
        now: now.toISOString(),
        ...result,
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
