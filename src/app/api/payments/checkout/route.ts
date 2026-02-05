import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma";
import Stripe from "stripe";

export const runtime = "nodejs";

type Body = {
    reservationId: string;
};

export async function POST(req: Request) {
    const body = (await req.json()) as Body;

    if (!body.reservationId) {
        return NextResponse.json({ error: "reservationId is required" }, { status: 400 });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const now = new Date();

    // 1) Cargar reserva + session + payment + customer
    const reservation = await prisma.reservation.findUnique({
        where: { id: body.reservationId },
        include: { session: true, payment: true, customer: true },
    });

    if (!reservation) {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (!reservation.payment) {
        return NextResponse.json({ error: "Payment record missing" }, { status: 500 });
    }

    // 2) Validaciones de negocio
    if (reservation.status !== ReservationStatus.HOLD) {
        return NextResponse.json({ error: "Reservation must be HOLD to pay" }, { status: 400 });
    }

    if (reservation.holdExpiresAt && reservation.holdExpiresAt < now) {
        return NextResponse.json({ error: "Reservation HOLD expired" }, { status: 400 });
    }

    if (reservation.payment.status === PaymentStatus.SUCCEEDED) {
        return NextResponse.json({ error: "Already paid" }, { status: 409 });
    }

    // 3) ✅ Idempotencia práctica:
    // Si ya tenemos un checkoutSessionId, intentamos reutilizarlo.
    if (reservation.payment.stripeCheckoutSessionId) {
        try {
            const existing = await stripe.checkout.sessions.retrieve(
                reservation.payment.stripeCheckoutSessionId
            );

            // Si Stripe aún nos da una URL, normalmente sigue siendo utilizable
            if (existing.url) {
                return NextResponse.json({ ok: true, checkoutUrl: existing.url, reused: true });
            }

            // Si no hay url, es probable que:
            // - esté completada, o
            // - esté expirada/cerrada, o
            // - Stripe no la expone por algún motivo
            // En esos casos seguimos y creamos una nueva.
        } catch {
            // Si falla el retrieve (ID inválido, etc), creamos nueva sesión.
        }
    }

    // 4) Crear Checkout Session
    // Usamos los datos del Payment (lo que realmente vamos a cobrar)
    const amount = reservation.payment.amountCents;
    const currency = reservation.payment.currency;

    // Idempotency key:
    // - evita duplicar checkout si este request se repite “igual” (timeouts/reintentos)
    // - usando payment.id suele ser suficiente, porque solo queremos 1 checkout activo por payment
    const idempotencyKey = `checkout_${reservation.payment.id}`;

    // Stripe requiere que expires_at esté entre 30 min y 24 h desde "ahora".
    // Si el hold restante es < 30 min, NO podemos usar expires_at sin que Stripe falle.
    // En ese caso, lo dejamos undefined y dependeremos de tu cleanup/webhook.
    const expiresAtSeconds =
        reservation.holdExpiresAt && reservation.holdExpiresAt.getTime() - now.getTime() >= 30 * 60 * 1000
            ? Math.floor(reservation.holdExpiresAt.getTime() / 1000)
            : undefined;


    let session: Stripe.Checkout.Session;

    try {
        session = await stripe.checkout.sessions.create(
            {
                mode: "payment",

                // Solo lo mandamos si existe (evita enviar undefined)
                ...(expiresAtSeconds ? { expires_at: expiresAtSeconds } : {}),

                customer_email: reservation.customer.email ?? undefined,

                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency,
                            unit_amount: amount,
                            product_data: { name: "DeltaRoutes - Tour guiado" },
                        },
                    },
                ],

                success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${appUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,

                metadata: {
                    reservationId: reservation.id,
                    paymentId: reservation.payment.id,
                },
            },
            { idempotencyKey }
        );
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Stripe error";
        return NextResponse.json({ error: message }, { status: 500 });
    }



    // 5) Persistir refs Stripe en tu Payment
    await prisma.payment.update({
        where: { id: reservation.payment.id },
        data: {
            status: PaymentStatus.PENDING,
            stripeCheckoutSessionId: session.id,
        },
    });

    return NextResponse.json({ ok: true, checkoutUrl: session.url, reused: false });
}
