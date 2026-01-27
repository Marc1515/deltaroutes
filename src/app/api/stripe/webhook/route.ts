import "dotenv/config";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma";
import Stripe from "stripe";


export async function POST(req: Request) {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

    const rawBody = await req.text();

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid signature";
        return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Evento clave de Checkout: checkout.session.completed :contentReference[oaicite:3]{index=3}
    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const reservationId = session?.metadata?.reservationId;
        const checkoutSessionId = session?.id as string | undefined;
        const paymentIntentId = session?.payment_intent as string | undefined;

        if (!reservationId || !checkoutSessionId) {
            return NextResponse.json({ error: "Missing metadata reservationId" }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            // actualizar pago
            await tx.payment.updateMany({
                where: { stripeCheckoutSessionId: checkoutSessionId },
                data: {
                    status: PaymentStatus.SUCCEEDED,
                    stripePaymentIntentId: paymentIntentId ?? undefined,
                },
            });

            // confirmar reserva (si sigue HOLD)
            await tx.reservation.update({
                where: { id: reservationId },
                data: {
                    status: ReservationStatus.CONFIRMED,
                    holdExpiresAt: null,
                },
            });
        });
    }

    return NextResponse.json({ received: true });
}
