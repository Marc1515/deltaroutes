import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import TestEmail from "@/emails/TestEmail";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const secret = process.env.DEV_EMAIL_TEST_SECRET;
    const to = process.env.DEV_EMAIL_TO;
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    if (!secret) {
        return NextResponse.json({ ok: false, error: "Missing DEV_EMAIL_TEST_SECRET" }, { status: 500 });
    }
    if (!to) {
        return NextResponse.json({ ok: false, error: "Missing DEV_EMAIL_TO" }, { status: 500 });
    }

    const headerSecret = req.headers.get("x-dev-secret");
    if (headerSecret !== secret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await sendEmail({
            to,
            subject: "DeltaRoutes · Test email (Resend + React Email)",
            react: TestEmail({ appUrl }),
        });

        return NextResponse.json({ ok: true, result });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
