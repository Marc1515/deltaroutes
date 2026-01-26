import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReservationStatus, PaymentStatus } from "@/generated/prisma";

export async function POST() {
    const now = new Date();

    // Opcional: dryRun para ver qué tocaría sin modificar
    // (si luego lo quieres, lo añadimos con query param)
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1) Encontrar reservas HOLD expiradas
            const expiredHolds = await tx.reservation.findMany({
                where: {
                    status: ReservationStatus.HOLD,
                    holdExpiresAt: { lt: now },
                },
                select: {
                    id: true,
                    holdExpiresAt: true,
                    payment: { select: { id: true, status: true } },
                },
            });

            if (expiredHolds.length === 0) {
                return { expiredCount: 0, reservationIds: [] as string[] };
            }

            const ids = expiredHolds.map((r) => r.id);

            // 2) Marcar reservas como EXPIRED
            await tx.reservation.updateMany({
                where: { id: { in: ids } },
                data: {
                    status: ReservationStatus.EXPIRED,
                    // opcional: limpiar para dejar el registro más “limpio”
                    holdExpiresAt: null,
                },
            });

            // 3) Marcar pagos relacionados como CANCELED si siguen en PENDING/REQUIRES_PAYMENT
            // (si ya estuvieran SUCCEEDED no debería pasar, pero por seguridad filtramos)
            await tx.payment.updateMany({
                where: {
                    reservationId: { in: ids },
                    status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT] },
                },
                data: { status: PaymentStatus.CANCELED },
            });

            return { expiredCount: ids.length, reservationIds: ids };
        });

        return NextResponse.json({ ok: true, ...result, now: now.toISOString() });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
