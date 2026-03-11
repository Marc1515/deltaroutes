import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type { ContactInquiryType } from "@/features/contact/contact.types";

type ContactMessageEmailProps = {
  name: string;
  email: string;
  phone?: string;
  inquiryType: ContactInquiryType;
  groupSize?: string;
  preferredDates?: string;
  message: string;
};

const inquiryLabels: Record<ContactInquiryType, string> = {
  question: "Duda previa",
  group: "Viaje en grupo",
  tailored: "Propuesta a medida",
};

type DetailRowProps = {
  label: string;
  value?: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  if (!value) {
    return null;
  }

  return (
    <Text className="m-0 text-slate-700">
      <span className="font-semibold">{label}:</span> {value}
    </Text>
  );
}

export default function ContactMessageEmail({
  name,
  email,
  phone,
  inquiryType,
  groupSize,
  preferredDates,
  message,
}: ContactMessageEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Nuevo mensaje recibido desde el formulario de contacto</Preview>

      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Tailwind>
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow">
            <Section>
              <Text className="text-2xl font-bold text-slate-900">
                DeltaRoutes
              </Text>

              <Text className="text-slate-700">
                Has recibido una nueva consulta desde la landing.
              </Text>

              <Section className="mt-4 rounded-xl bg-slate-50 p-4">
                <DetailRow label="Tipo de consulta" value={inquiryLabels[inquiryType]} />
                <DetailRow label="Nombre" value={name} />
                <DetailRow label="Email" value={email} />
                <DetailRow label="Teléfono" value={phone} />
                <DetailRow label="Tamaño del grupo" value={groupSize} />
                <DetailRow label="Fechas o idea de viaje" value={preferredDates} />
              </Section>

              <Hr className="my-6 border-slate-200" />

              <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Mensaje
              </Text>
              <Text className="whitespace-pre-wrap text-slate-700">{message}</Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}
