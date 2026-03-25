import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { getResendClient } from "@/lib/resend";

type SendEmailArgs = {
    to: string;
    subject: string;
    react: ReactElement;
    replyTo?: string;
};

export async function sendEmail({ to, subject, react, replyTo }: SendEmailArgs) {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("Missing EMAIL_FROM env var");

    const resend = getResendClient();

    const html = await render(react);
    const text = await render(react, { plainText: true });

    const result = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
    });

    if (result.error) {
        throw new Error(`Resend rejected email: ${result.error.message}`);
    }

    return result;
}