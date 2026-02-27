"use client";

import { useEffect, useState } from "react";
import type { SessionAvailability } from "../types/booking.types";
import { fetchSessions } from "../api/booking.api";

export function useSessions(args: { experienceId?: string; pax?: number }) {
    const { experienceId, pax } = args;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionAvailability[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!experienceId || !pax) return;

            setLoading(true);
            setError(null);

            const res = await fetchSessions({ experienceId, pax });

            if (cancelled) return;

            if (!res.ok) {
                setSessions([]);
                setError(res.error || "Error cargando sesiones");
            } else {
                setSessions(res.sessions);
            }

            setLoading(false);
        }

        run().catch((e) => {
            if (cancelled) return;
            setLoading(false);
            setError(e instanceof Error ? e.message : "Error desconocido");
        });

        return () => {
            cancelled = true;
        };
    }, [experienceId, pax]);

    return { loading, error, sessions };
}