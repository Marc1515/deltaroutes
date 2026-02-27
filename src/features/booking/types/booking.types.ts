import type { LanguageBase } from "@/generated/prisma";

export type SessionAvailability = {
    id: string;
    experienceId: string;
    startAt: string;
    bookingClosesAt: string;
    maxSeatsTotal: number;
    reservedSeats: number;
    freeSeats: number;
    canFit: boolean;
    isCancelled: boolean;
};

export type SessionsResponse =
    | { ok: true; pax: number; sessions: SessionAvailability[] }
    | { ok: false; error: string };

export type WaitlistBody = {
    sessionId: string;
    customerEmail: string;
    adultsCount: number;
    minorsCount: number;
};

export type WaitlistResponse =
    | { ok: true; reservationId: string; status: string; totalPax: number }
    | { ok: false; error: string };

export type CreateHoldBody = {
    sessionId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    tourLanguage: LanguageBase;
    adultsCount: number;
    minorsCount: number;
};

export type CreateHoldResponse =
    | { ok: true; kind: "HOLD"; reservationId: string; holdExpiresAt: string }
    | { ok: true; kind: "WAITING"; reservationId: string }
    | { ok: false; error: string };

export type CheckoutResponse =
    | { ok: true; checkoutUrl: string; reused: boolean }
    | { ok: false; error: string };