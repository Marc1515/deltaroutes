"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionAvailability } from "../types/booking.types";
import { fetchSessions } from "../api/booking.api";

export function useSessions(args: {
    experienceId?: string;
    pax?: number;
    autoRefreshEnabled?: boolean;
    refreshIntervalMs?: number;
}) {
    const {
        experienceId,
        pax,
        autoRefreshEnabled = false,
        refreshIntervalMs = 2000,
    } = args;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionAvailability[]>([]);

    const loadSessions = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false;

        if (!experienceId || !pax) {
            setSessions([]);
            setError(null);
            setLoading(false);
            return;
        }

        if (!silent) {
            setLoading(true);
        }
        setError(null);

        try {
            const res = await fetchSessions({ experienceId, pax });

            if (!res.ok) {
                setSessions([]);
                setError(res.error || "Error cargando sesiones");
                return;
            }

            setSessions(res.sessions);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [experienceId, pax]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!experienceId || !pax) {
                if (!cancelled) {
                    setSessions([]);
                    setError(null);
                    setLoading(false);
                }
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const res = await fetchSessions({ experienceId, pax });

                if (cancelled) return;

                if (!res.ok) {
                    setSessions([]);
                    setError(res.error || "Error cargando sesiones");
                    return;
                }

                setSessions(res.sessions);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Error desconocido");
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void run();

        return () => {
            cancelled = true;
        };
    }, [experienceId, pax]);

    useEffect(() => {
        if (!autoRefreshEnabled || !experienceId || !pax) return;

        const intervalId = window.setInterval(() => {
            void loadSessions({ silent: true });
        }, refreshIntervalMs);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [autoRefreshEnabled, experienceId, pax, refreshIntervalMs, loadSessions]);

    return { loading, error, sessions, refreshSessions: loadSessions };
}