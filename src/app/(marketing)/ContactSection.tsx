"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  CONTACT_INQUIRY_TYPES,
  type ContactApiResponse,
  type ContactFormPayload,
  type ContactInquiryType,
} from "@/features/contact/contact.types";

function GmailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 6.75 12 13.5l9-6.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 6h15A1.5 1.5 0 0 1 21 7.5v9A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 21a8.96 8.96 0 0 0 4.41-1.16L21 21l-1.2-4.39A9 9 0 1 0 12 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.25 8.75c.2-.45.41-.46.6-.47h.5c.17 0 .4.06.61.53.21.47.71 1.64.77 1.76.06.12.1.27.02.43-.08.16-.12.26-.24.4-.12.14-.25.31-.35.41-.12.12-.25.25-.11.49.14.24.62 1.02 1.33 1.65.91.8 1.68 1.05 1.92 1.17.24.12.38.1.52-.06.14-.16.58-.67.73-.9.15-.23.31-.19.52-.11.21.08 1.35.64 1.58.75.23.12.39.18.45.28.06.1.06.61-.14 1.19-.2.58-1.17 1.13-1.61 1.2-.41.07-.93.1-1.5-.09-.34-.11-.78-.26-1.34-.5-2.37-.99-3.92-3.43-4.04-3.6-.12-.17-.96-1.28-.96-2.45 0-1.17.61-1.74.82-1.98Z"
        fill="currentColor"
      />
    </svg>
  );
}

const inquiryLabels: Record<ContactInquiryType, string> = {
  question: "Tengo una duda",
  group: "Viajo en grupo",
  tailored: "Quiero una propuesta a medida",
};

const initialFormState: ContactFormPayload = {
  name: "",
  email: "",
  phone: "",
  inquiryType: "question",
  groupSize: "",
  preferredDates: "",
  message: "",
  website: "",
};

const CONTACT_FORM_STORAGE_KEY = "deltaroutes.contact-form";
const inquiryTypeSet = new Set<ContactInquiryType>(CONTACT_INQUIRY_TYPES);

function restoreStoredFormData(value: string | null): ContactFormPayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ContactFormPayload>;
    const inquiryType = parsed.inquiryType;

    return {
      name: typeof parsed.name === "string" ? parsed.name : initialFormState.name,
      email: typeof parsed.email === "string" ? parsed.email : initialFormState.email,
      phone: typeof parsed.phone === "string" ? parsed.phone : initialFormState.phone,
      inquiryType:
        typeof inquiryType === "string" && inquiryTypeSet.has(inquiryType as ContactInquiryType)
          ? (inquiryType as ContactInquiryType)
          : initialFormState.inquiryType,
      groupSize:
        typeof parsed.groupSize === "string" ? parsed.groupSize : initialFormState.groupSize,
      preferredDates:
        typeof parsed.preferredDates === "string"
          ? parsed.preferredDates
          : initialFormState.preferredDates,
      message: typeof parsed.message === "string" ? parsed.message : initialFormState.message,
      website: typeof parsed.website === "string" ? parsed.website : initialFormState.website,
    };
  } catch {
    return null;
  }
}

export function ContactSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [formData, setFormData] = useState<ContactFormPayload>(initialFormState);
  const hasLoadedStoredDraftRef = useRef(false);
  const [areContactCardsVisible, setAreContactCardsVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ContactFormPayload, string>>
  >({});

  const showPlanningFields = formData.inquiryType !== "question";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const restoredFormData = restoreStoredFormData(
        window.localStorage.getItem(CONTACT_FORM_STORAGE_KEY),
      );

      if (restoredFormData) {
        setFormData(restoredFormData);
      }

      hasLoadedStoredDraftRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredDraftRef.current) {
      return;
    }

    window.localStorage.setItem(CONTACT_FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const node = sectionRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        setAreContactCardsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  function getRevealStyle(index: number) {
    return areContactCardsVisible
      ? {
          animation: `experience-card-reveal 950ms cubic-bezier(0.22, 1, 0.36, 1) ${
            index * 180
          }ms both`,
        }
      : undefined;
  }

  function updateField<K extends keyof ContactFormPayload>(
    field: K,
    value: ContactFormPayload[K],
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
    setStatus("idle");
    setFeedbackMessage("");
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setFeedbackMessage("");
    setFieldErrors({});

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const json = (await response.json()) as ContactApiResponse;

      if (!response.ok || !json.ok) {
        const message =
          !json.ok && json.error.message
            ? json.error.message
            : "No hemos podido enviar tu mensaje. Intenta de nuevo en unos minutos.";

        setStatus("error");
        setFeedbackMessage(message);

        if (!json.ok && json.error.fieldErrors) {
          setFieldErrors(json.error.fieldErrors);
        }

        return;
      }

      setStatus("success");
      setFeedbackMessage(json.message);
      window.localStorage.removeItem(CONTACT_FORM_STORAGE_KEY);
      setFormData(initialFormState);
    } catch {
      setStatus("error");
      setFeedbackMessage(
        "No hemos podido enviar tu mensaje. Revisa tu conexion o escribenos por WhatsApp o email.",
      );
    }
  }

  const feedbackTone =
    status === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : "border-red-400/30 bg-red-500/10 text-red-100";

  const inputClassName =
    "mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/35 focus:bg-white/8";

  return (
    <section
      ref={sectionRef}
      className="relative z-10 min-h-screen w-full bg-black text-white"
      id="contact"
      aria-label="Contacto"
    >
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div
          className="experience-card-reveal max-w-2xl"
          style={getRevealStyle(0)}
        >
          <h2 className="text-2xl font-semibold sm:text-3xl">Contacto</h2>
          <p className="mt-4 text-sm leading-7 text-white/75 sm:text-base">
            Si todavía no sabes qué experiencia encaja mejor contigo, viajas en
            grupo o necesitas una propuesta más personalizada, aquí tienes una
            forma sencilla de hablar con nosotros.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <div className="space-y-6">
            <div
              className="experience-card-reveal rounded-4xl border border-white/10 bg-white/3 p-6"
              style={getRevealStyle(1)}
            >
              <h3 className="text-lg font-medium">Canales directos</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Si prefieres escribirnos directamente, respondemos por email y
                WhatsApp con la misma cercanía.
              </p>

              <div className="mt-6 grid gap-3 text-sm">
                <a
                  href="mailto:hola@deltaroutes.com"
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                    <GmailIcon />
                  </span>
                  <span>
                    <span className="block font-medium">Email</span>
                    <span className="text-white/70">hola@deltaroutes.com</span>
                  </span>
                </a>

                <a
                  href="https://wa.me/34600000000"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                    <WhatsAppIcon />
                  </span>
                  <span>
                    <span className="block font-medium">WhatsApp</span>
                    <span className="text-white/70">+34 600 000 000</span>
                  </span>
                </a>
              </div>
            </div>

            <div
              className="experience-card-reveal rounded-4xl border border-white/10 bg-white/3 p-6"
              style={getRevealStyle(2)}
            >
              <h3 className="text-lg font-medium">Así funciona la reserva</h3>
              <ol className="mt-5 space-y-4">
                <li className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-medium">
                    1
                  </span>
                  <div>
                    <p className="font-medium">Eliges experiencia y sesión</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      Puedes explorar la actividad que más te apetezca y escoger
                      la salida disponible que mejor encaje con tu viaje.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-medium">
                    2
                  </span>
                  <div>
                    <p className="font-medium">Si hay plaza, la guardamos un momento</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      Cuando hay disponibilidad, el sistema conserva tu plaza de
                      forma temporal para que puedas completar la reserva con
                      calma.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-medium">
                    3
                  </span>
                  <div>
                    <p className="font-medium">Si no la hay, te avisamos por email</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      Si una salida está completa, puedes dejarnos tu email y te
                      escribiremos si vuelven a liberarse plazas para tu grupo.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <div
            className="experience-card-reveal rounded-4xl border border-white/10 bg-white/4 p-6 sm:p-7"
            style={getRevealStyle(3)}
          >
            <div className="max-w-xl">
              <h3 className="text-lg font-medium">Cuéntanos qué necesitas</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Este formulario es ideal para dudas previas, grupos, fechas
                concretas o propuestas a medida. Te responderemos lo antes
                posible.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-white/80">Nombre</span>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className={inputClassName}
                    placeholder="Tu nombre"
                    autoComplete="name"
                  />
                  {fieldErrors.name ? (
                    <span className="mt-2 block text-xs text-red-200">
                      {fieldErrors.name}
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm">
                  <span className="text-white/80">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className={inputClassName}
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                  {fieldErrors.email ? (
                    <span className="mt-2 block text-xs text-red-200">
                      {fieldErrors.email}
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-white/80">Teléfono</span>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className={inputClassName}
                    placeholder="+34 ..."
                    autoComplete="tel"
                  />
                  {fieldErrors.phone ? (
                    <span className="mt-2 block text-xs text-red-200">
                      {fieldErrors.phone}
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm">
                  <span className="text-white/80">Tipo de consulta</span>
                  <select
                    name="inquiryType"
                    value={formData.inquiryType}
                    onChange={(event) =>
                      updateField("inquiryType", event.target.value as ContactInquiryType)
                    }
                    className={inputClassName}
                  >
                    {CONTACT_INQUIRY_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-slate-950">
                        {inquiryLabels[type]}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.inquiryType ? (
                    <span className="mt-2 block text-xs text-red-200">
                      {fieldErrors.inquiryType}
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-white/80">Tamaño del grupo</span>
                  <input
                    type="text"
                    name="groupSize"
                    value={formData.groupSize}
                    onChange={(event) => updateField("groupSize", event.target.value)}
                    className={inputClassName}
                    placeholder={showPlanningFields ? "Ej. 8 personas" : "Opcional"}
                  />
                  {fieldErrors.groupSize ? (
                    <span className="mt-2 block text-xs text-red-200">
                      {fieldErrors.groupSize}
                    </span>
                  ) : null}
                </label>

                <label className="block text-sm">
                  <span className="text-white/80">Fechas o idea de viaje</span>
                  <input
                    type="text"
                    name="preferredDates"
                    value={formData.preferredDates}
                    onChange={(event) =>
                      updateField("preferredDates", event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Opcional"
                  />
                  {fieldErrors.preferredDates ? (
                    <span className="mt-2 block text-xs text-red-200">
                      {fieldErrors.preferredDates}
                    </span>
                  ) : null}
                </label>
              </div>

              <label className="block text-sm">
                <span className="text-white/80">Mensaje</span>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  className={`${inputClassName} min-h-36 resize-y`}
                  placeholder="Cuéntanos qué estás buscando y te orientamos."
                />
                {fieldErrors.message ? (
                  <span className="mt-2 block text-xs text-red-200">
                    {fieldErrors.message}
                  </span>
                ) : null}
              </label>

              <label className="hidden">
                <span>Website</span>
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.website}
                  onChange={(event) => updateField("website", event.target.value)}
                />
              </label>

              {feedbackMessage ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${feedbackTone}`}
                  aria-live="polite"
                >
                  {feedbackMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-white/55">
                  Usamos tus datos solo para responder a esta consulta.
                </p>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "submitting" ? "Enviando..." : "Enviar mensaje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
