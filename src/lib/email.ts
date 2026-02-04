import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { resend } from "@/lib/resend";

type SendEmailArgs = {
    to: string;
    subject: string;
    react: ReactElement;
};

export async function sendEmail({ to, subject, react }: SendEmailArgs) {
    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error("Missing EMAIL_FROM env var");
    if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY env var");

    // 👇 render puede ser async según versión
    const html = await render(react);

    const result = await resend.emails.send({
        from,
        to,
        subject,
        html,
    });

    return result;
}
