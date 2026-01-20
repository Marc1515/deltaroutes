// src/app/api/reservations/route.ts
import "dotenv/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LanguageBase, LanguageCode, ReservationStatus, PaymentStatus } from "@/generated/prisma";

type Body = {
  sessionId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  primaryLanguage: LanguageBase;       // CA | ES | EN
  preferredLanguage?: LanguageCode;    // opcional (DE/FR/IT...)
};

const HOLD_MINUTES = 15;

function baseToCode(l: LanguageBase): LanguageCode {
  // Como comparten valores, basta con mapear
  return l as unknown as LanguageCode;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body.sessionId || !body.customerName || !body.primaryLanguage) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUniqueOrThrow({
        where: { id: body.sessionId },
        include: { experience: true },
      });


      if (session.isCancelled) {
        return { ok: false as const, status: 400, error: "Session is cancelled" };
      }

      if (now > session.bookingClosesAt) {
        return { ok: false as const, status: 400, error: "Booking is closed for this session" };
      }

      // 1) upsert customer (sin cuenta)
      // - Si hay email, usamos email como "key" para evitar duplicados.
      // - Si no hay email, creamos uno nuevo siempre.
      const customer = body.customerEmail
        ? await tx.customer.upsert({
          where: { email: body.customerEmail },
          update: { name: body.customerName, phone: body.customerPhone ?? undefined },
          create: { name: body.customerName, email: body.customerEmail, phone: body.customerPhone ?? null },
        })
        : await tx.customer.create({
          data: { name: body.customerName, phone: body.customerPhone ?? null, email: null },
        });


      // Evitar duplicado del mismo customer en la misma sesión (por @@unique)
      // Lo dejamos que lo maneje Prisma con error, o comprobamos antes:
      const existing = await tx.reservation.findUnique({
        where: { sessionId_customerId: { sessionId: session.id, customerId: customer.id } },
      });
      if (existing) {
        return { ok: false as const, status: 409, error: "Customer already has a reservation for this session" };
      }

      // 2) contar plazas ocupadas (CONFIRMED + HOLD) -> cuentan como ocupadas
      const taken = await tx.reservation.count({
        where: {
          sessionId: session.id,
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
        },
      });

      // Si ya no hay plazas, entra en WAITING
      if (taken >= session.maxSeatsTotal) {
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            primaryLanguage: body.primaryLanguage,
            preferredLanguage: body.preferredLanguage ?? null,
          },
        });

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      // 3) buscar guías compatibles por idioma (preferencia primero, fallback a primary)
      const tryLanguages: (LanguageCode | LanguageBase)[] = [];
      if (body.preferredLanguage) tryLanguages.push(body.preferredLanguage);
      tryLanguages.push(body.primaryLanguage);

      // Nota: body.primaryLanguage es LanguageBase, pero LanguageCode contiene CA/ES/EN también
      // Lo tratamos igual buscando en User.languages (LanguageCode[])
      const candidateGuides = await tx.user.findMany({
        where: {
          role: "GUIDE",
          isActive: true,
          OR: tryLanguages.map((lng) => ({ languages: { has: lng } })),
        },
        select: { id: true, languages: true },
      });


      // Función helper: encuentra guía con plazas disponibles para un idioma concreto
      async function pickGuideForLanguage(lang: LanguageCode) {
        const guides = candidateGuides.filter((g) => g.languages.includes(lang));
        if (guides.length === 0) return null;

        // Contar reservas por guía (CONFIRMED + HOLD) en esa sesión
        const counts = await tx.reservation.groupBy({
          by: ["guideUserId"],
          where: {
            sessionId: session.id,
            status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.HOLD] },
            guideUserId: { in: guides.map((g) => g.id) },
          },
          _count: { _all: true },
        });

        const countMap = new Map<string, number>();
        for (const row of counts) {
          if (row.guideUserId) countMap.set(row.guideUserId, row._count._all);
        }

        // elige el guía con menos carga y < maxPerGuide
        const sorted = guides
          .map((g) => ({ id: g.id, load: countMap.get(g.id) ?? 0 }))
          .sort((a, b) => a.load - b.load);

        const chosen = sorted.find((g) => g.load < session.maxPerGuide);
        return chosen?.id ?? null;
      }

      // intentamos preferido y luego primary
      let guideUserId: string | null = null;

      if (body.preferredLanguage) {
        guideUserId = await pickGuideForLanguage(body.preferredLanguage);
      }
      if (!guideUserId) {
        guideUserId = await pickGuideForLanguage(body.primaryLanguage);
      }

      // Si no hay guía disponible, WAITING (aunque haya plazas globales)
      if (!guideUserId) {
        const waiting = await tx.reservation.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            status: ReservationStatus.WAITING,
            primaryLanguage: body.primaryLanguage,
            preferredLanguage: body.preferredLanguage ?? null,
          },
        });

        return { ok: true as const, kind: "WAITING" as const, reservationId: waiting.id };
      }

      // 4) crear HOLD + Payment (Stripe lo conectamos después)
      const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

      const reservation = await tx.reservation.create({
        data: {
          sessionId: session.id,
          customerId: customer.id,
          guideUserId,
          status: ReservationStatus.HOLD,
          holdExpiresAt,
          primaryLanguage: body.primaryLanguage,
          preferredLanguage: body.preferredLanguage ?? null,
        },
      });

      // Payment placeholder (en V2 lo enlazamos con Stripe Checkout)
      if (session.requiresPayment) {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            status: PaymentStatus.PENDING,
            amountCents: session.priceCents,
            currency: session.currency,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            status: PaymentStatus.NOT_REQUIRED,
            amountCents: 0,
            currency: session.currency,
          },
        });
      }

      return { ok: true as const, kind: "HOLD" as const, reservationId: reservation.id, holdExpiresAt };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";

    if (message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }

}
