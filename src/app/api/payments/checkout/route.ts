import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma";

type Body = {
    reservationId: string;
};

export async function POST(req: Request) {
    const body = (await req.json()) as Body;
    if (!body.reservationId) {
        return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    // 1) Cargar reserva + sesión + payment
    const reservation = await prisma.reservation.findUnique({
        where: { id: body.reservationId },
        include: { session: true, payment: true, customer: true },
    });

    if (!reservation) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status !== ReservationStatus.HOLD) {
        return NextResponse.json({ error: "Reservation must be HOLD to pay" }, { status: 400 });
    }

    // si expiró, no dejamos pagar
    if (reservation.holdExpiresAt && reservation.holdExpiresAt < new Date()) {
        return NextResponse.json({ error: "Reservation HOLD expired" }, { status: 400 });
    }

    if (!reservation.payment) {
        return NextResponse.json({ error: "Payment record missing" }, { status: 500 });
    }

    if (reservation.payment.status === PaymentStatus.SUCCEEDED) {
        return NextResponse.json({ error: "Already paid" }, { status: 409 });
    }

    // 2) Crear Checkout Session (Stripe)
    // Guardamos reservationId como metadata para recuperarlo en el webhook.
    // Metadata es el patrón típico para enlazar Stripe con tu BD. :contentReference[oaicite:2]{index=2}
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: reservation.customer.email ?? undefined,
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: reservation.session.currency,
                    unit_amount: reservation.session.priceCents,
                    product_data: {
                        name: "DeltaRoutes - Tour guiado",
                    },
                },
            },
        ],
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
        metadata: {
            reservationId: reservation.id,
            paymentId: reservation.payment.id,
        },
    });

    // 3) Persistir refs Stripe
    await prisma.payment.update({
        where: { id: reservation.payment.id },
        data: {
            status: PaymentStatus.PENDING,
            stripeCheckoutSessionId: session.id,
        },
    });

    return NextResponse.json({ ok: true, checkoutUrl: session.url });
}
