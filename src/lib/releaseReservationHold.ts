import { PaymentStatus, ReservationStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type ReleaseReservationHoldArgs = {
  reservationId?: string;
  checkoutSessionId?: string;
};

export type ReleaseReservationHoldResult =
  | {
      ok: true;
      released: boolean;
      reservationId: string;
      reservationStatus: ReservationStatus;
      paymentStatus: PaymentStatus | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function canCancelPayment(status: PaymentStatus) {
  return status === PaymentStatus.PENDING || status === PaymentStatus.REQUIRES_PAYMENT;
}

export async function releaseReservationHold(
  args: ReleaseReservationHoldArgs,
): Promise<ReleaseReservationHoldResult> {
  const reservationId = args.reservationId?.trim();
  const checkoutSessionId = args.checkoutSessionId?.trim();

  if (!reservationId && !checkoutSessionId) {
    return { ok: false, error: "reservationId or checkoutSessionId is required", status: 400 };
  }

  const reservation = reservationId
    ? await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { payment: true },
      })
    : await prisma.reservation.findFirst({
        where: { payment: { stripeCheckoutSessionId: checkoutSessionId } },
        include: { payment: true },
      });

  if (!reservation) {
    return { ok: false, error: "Reservation not found", status: 404 };
  }

  const currentPaymentStatus = reservation.payment?.status ?? null;

  if (reservation.status !== ReservationStatus.HOLD) {
    return {
      ok: true,
      released: false,
      reservationId: reservation.id,
      reservationStatus: reservation.status,
      paymentStatus: currentPaymentStatus,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshReservation = await tx.reservation.findUnique({
      where: { id: reservation.id },
      include: { payment: true },
    });

    if (!freshReservation) {
      return { ok: false, error: "Reservation not found", status: 404 } as const;
    }

    const freshPaymentStatus = freshReservation.payment?.status ?? null;

    if (freshReservation.status !== ReservationStatus.HOLD) {
      return {
        ok: true,
        released: false,
        reservationId: freshReservation.id,
        reservationStatus: freshReservation.status,
        paymentStatus: freshPaymentStatus,
      } as const;
    }

    const updatedReservation = await tx.reservation.updateMany({
      where: { id: freshReservation.id, status: ReservationStatus.HOLD },
      data: {
        status: ReservationStatus.EXPIRED,
        holdExpiresAt: null,
      },
    });

    if (updatedReservation.count !== 1) {
      return {
        ok: true,
        released: false,
        reservationId: freshReservation.id,
        reservationStatus: freshReservation.status,
        paymentStatus: freshPaymentStatus,
      } as const;
    }

    let nextPaymentStatus = freshPaymentStatus;

    if (freshReservation.payment && canCancelPayment(freshReservation.payment.status)) {
      await tx.payment.updateMany({
        where: {
          id: freshReservation.payment.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT] },
        },
        data: { status: PaymentStatus.CANCELED },
      });

      nextPaymentStatus = PaymentStatus.CANCELED;
    }

    return {
      ok: true,
      released: true,
      reservationId: freshReservation.id,
      reservationStatus: ReservationStatus.EXPIRED,
      paymentStatus: nextPaymentStatus,
    } as const;
  });

  return result;
}
