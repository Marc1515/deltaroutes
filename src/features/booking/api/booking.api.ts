import type {
    SessionsResponse,
    WaitlistBody,
    WaitlistResponse,
    CreateHoldBody,
    CreateHoldResponse,
    CheckoutResponse,
    ReleaseHoldBody,
    ReleaseHoldResponse,
    UpdateHoldBody,
    UpdateHoldResponse,
} from "../types/booking.types";

async function safeJson<T>(res: Response): Promise<T> {
    const data = (await res.json()) as T;
    return data;
}

export async function fetchSessions(args: { experienceId: string; pax: number }) {
    const url = `/api/sessions?experienceId=${encodeURIComponent(args.experienceId)}&pax=${args.pax}`;
    const res = await fetch(url, { method: "GET" });
    return safeJson<SessionsResponse>(res);
}

export async function joinWaitlist(body: WaitlistBody) {
    const res = await fetch(`/api/reservations/waiting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return safeJson<WaitlistResponse>(res);
}

export async function createHoldReservation(body: CreateHoldBody) {
    const res = await fetch(`/api/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return safeJson<CreateHoldResponse>(res);
}

export async function createCheckout(args: { reservationId: string }) {
    const res = await fetch(`/api/payments/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
    });
    return safeJson<CheckoutResponse>(res);
}

export async function releaseHoldReservation(body: ReleaseHoldBody) {
    const res = await fetch(`/api/reservations/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return safeJson<ReleaseHoldResponse>(res);
}

export async function updateHoldReservation(body: UpdateHoldBody) {
    const res = await fetch(`/api/reservations/hold/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return safeJson<UpdateHoldResponse>(res);
}