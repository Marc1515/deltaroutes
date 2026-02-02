import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
        return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // Buscamos el Payment por stripeCheckoutSessionId y traemos la reserva asociada
    const payment = await prisma.payment.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
        include: {
            reservation: {
                select: {
                    id: true,
                    status: true,
                },
            },
        },
    });

    if (!payment) {
        // Puede pasar si el webhook aún no ha guardado nada o si el session_id no existe
        return NextResponse.json(
            { ok: false, found: false, message: "Payment not found yet" },
            { status: 404 }
        );
    }

    return NextResponse.json({
        ok: true,
        found: true,
        reservationId: payment.reservation.id,
        reservationStatus: payment.reservation.status,
        paymentStatus: payment.status,
    });
}
