import { Resend } from "resend";

export function getResendClient() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        throw new Error("Missing RESEND_API_KEY env var");
    }

    return new Resend(apiKey);
}