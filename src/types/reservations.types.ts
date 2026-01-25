// src/types/reservations.types.ts
import type { LanguageBase } from "@/generated/prisma";

/** Request body para POST /api/reservations */
export type CreateReservationBody = {
    sessionId: string;
    customerName: string;
    customerEmail: string; // obligatorio
    customerPhone?: string;
    tourLanguage: LanguageBase; // CA | ES | EN
};

/** Respuesta del endpoint (útil para tipar frontend) */
export type CreateReservationResponse =
    | {
        ok: true;
        kind: "HOLD";
        reservationId: string;
        holdExpiresAt: string; // Date serializada a ISO string
    }
    | {
        ok: true;
        kind: "WAITING";
        reservationId: string;
    }
    | {
        ok: false;
        error: string;
    };
