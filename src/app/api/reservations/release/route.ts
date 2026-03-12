import { NextResponse } from "next/server";
import { releaseReservationHold } from "@/lib/releaseReservationHold";

export const runtime = "nodejs";

type Body = {
  reservationId?: string;
  checkoutSessionId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const result = await releaseReservationHold({
    reservationId: body.reservationId,
    checkoutSessionId: body.checkoutSessionId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
