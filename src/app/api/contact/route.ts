import { NextRequest, NextResponse } from "next/server";
import ContactMessageEmail from "@/emails/ContactMessageEmail";
import {
  getContactEmailConfig,
} from "@/features/contact/contact.env";
import {
  CONTACT_INQUIRY_TYPES,
  type ContactApiResponse,
  type ContactField,
  type ContactFormPayload,
  type ContactInquiryType,
} from "@/features/contact/contact.types";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inquiryTypeSet = new Set<ContactInquiryType>(CONTACT_INQUIRY_TYPES);
const rateLimitStore = new Map<string, number[]>();

const MAX_LENGTHS: Record<ContactField, number> = {
  name: 80,
  email: 120,
  phone: 40,
  inquiryType: 24,
  groupSize: 40,
  preferredDates: 120,
  message: 2000,
  website: 120,
};

function json(body: ContactApiResponse, status: number) {
  return NextResponse.json(body, { status });
}

function errorResponse(
  status: number,
  code: Extract<ContactApiResponse, { ok: false }>["error"]["code"],
  message: string,
  fieldErrors?: Partial<Record<ContactField, string>>,
  retryAfterSeconds?: number,
) {
  return json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
      },
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
    status,
  );
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRateLimitKey(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim();

  if (ip) {
    return `ip:${ip}`;
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 80) ?? "unknown";
  return `ua:${userAgent}`;
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  const recentHits = (rateLimitStore.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentHits.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(key, recentHits);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recentHits[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );

    return { limited: true as const, retryAfterSeconds };
  }

  recentHits.push(now);
  rateLimitStore.set(key, recentHits);
  return { limited: false as const, retryAfterSeconds: 0 };
}

function validatePayload(raw: Partial<ContactFormPayload>) {
  const payload: ContactFormPayload = {
    name: trimString(raw.name),
    email: trimString(raw.email).toLowerCase(),
    phone: trimString(raw.phone),
    inquiryType: trimString(raw.inquiryType) as ContactInquiryType,
    groupSize: trimString(raw.groupSize),
    preferredDates: trimString(raw.preferredDates),
    message: trimString(raw.message),
    website: trimString(raw.website),
  };

  const fieldErrors: Partial<Record<ContactField, string>> = {};

  if (!payload.name) {
    fieldErrors.name = "Dinos tu nombre para poder responderte.";
  } else if (payload.name.length > MAX_LENGTHS.name) {
    fieldErrors.name = "El nombre es demasiado largo.";
  }

  if (!payload.email) {
    fieldErrors.email = "Necesitamos un email de contacto.";
  } else if (payload.email.length > MAX_LENGTHS.email) {
    fieldErrors.email = "El email es demasiado largo.";
  } else if (!emailRegex.test(payload.email)) {
    fieldErrors.email = "Introduce un email válido.";
  }

  if (!payload.inquiryType) {
    fieldErrors.inquiryType = "Selecciona el tipo de consulta.";
  } else if (!inquiryTypeSet.has(payload.inquiryType)) {
    fieldErrors.inquiryType = "Selecciona una opción válida.";
  }

  if (payload.phone.length > MAX_LENGTHS.phone) {
    fieldErrors.phone = "El teléfono es demasiado largo.";
  }

  if (payload.groupSize.length > MAX_LENGTHS.groupSize) {
    fieldErrors.groupSize = "Indica el tamaño del grupo de forma más breve.";
  }

  if (payload.preferredDates.length > MAX_LENGTHS.preferredDates) {
    fieldErrors.preferredDates = "Resume un poco las fechas o idea de viaje.";
  }

  if (!payload.message) {
    fieldErrors.message = "Cuéntanos en qué podemos ayudarte.";
  } else if (payload.message.length > MAX_LENGTHS.message) {
    fieldErrors.message = "El mensaje es demasiado largo.";
  }

  if (
    payload.inquiryType !== "question" &&
    !payload.groupSize
  ) {
    fieldErrors.groupSize =
      "Si es para un grupo o una propuesta a medida, danos una idea del tamaño.";
  }

  return {
    payload,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}

const inquiryLabels: Record<ContactInquiryType, string> = {
  question: "Duda previa",
  group: "Viaje en grupo",
  tailored: "Propuesta a medida",
};

export async function POST(req: NextRequest) {
  let raw: Partial<ContactFormPayload>;

  try {
    raw = (await req.json()) as Partial<ContactFormPayload>;
  } catch {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "No hemos podido leer el formulario enviado.",
    );
  }

  const { payload, fieldErrors, isValid } = validatePayload(raw);

  if (payload.website) {
    return errorResponse(
      400,
      "SPAM_DETECTED",
      "No hemos podido procesar tu mensaje.",
    );
  }

  if (!isValid) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Revisa los campos marcados e inténtalo de nuevo.",
      fieldErrors,
    );
  }

  const rateLimit = consumeRateLimit(getRateLimitKey(req));
  if (rateLimit.limited) {
    return errorResponse(
      429,
      "RATE_LIMITED",
      "Has enviado varios mensajes en poco tiempo. Espera un poco y vuelve a intentarlo.",
      undefined,
      rateLimit.retryAfterSeconds,
    );
  }

  const contactEmailConfig = getContactEmailConfig();
  if (!contactEmailConfig.ok) {
    console.error("[api/contact] invalid contact email config:", contactEmailConfig.message);
    return errorResponse(
      500,
      "CONFIGURATION_ERROR",
      "El formulario no está disponible temporalmente.",
    );
  }

  const { to, subjectPrefix } = contactEmailConfig.config;

  try {
    await sendEmail({
      to,
      replyTo: payload.email,
      subject: `${subjectPrefix} · ${inquiryLabels[payload.inquiryType]}`,
      react: ContactMessageEmail({
        name: payload.name,
        email: payload.email,
        phone: payload.phone || undefined,
        inquiryType: payload.inquiryType,
        groupSize: payload.groupSize || undefined,
        preferredDates: payload.preferredDates || undefined,
        message: payload.message,
      }),
    });

    return json(
      {
        ok: true,
        message:
          "Mensaje enviado. Te responderemos lo antes posible por email.",
      },
      200,
    );
  } catch (error) {
    console.error("[api/contact] failed to send contact email:", error);
    return errorResponse(
      500,
      "SERVER_ERROR",
      "No hemos podido enviar tu mensaje en este momento. Prueba de nuevo o escríbenos directamente.",
    );
  }
}
