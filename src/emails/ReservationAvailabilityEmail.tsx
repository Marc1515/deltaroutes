import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

type Props = {
  customerName: string;
  activityLabel: string;
  startText: string;
  reservationCode: string;

  adultsCount: number;
  minorsCount: number;
  totalPax: number;

  actionUrl: string;
};

export default function ReservationAvailabilityEmail({
  customerName,
  activityLabel,
  startText,
  reservationCode,
  adultsCount,
  minorsCount,
  totalPax,
  actionUrl,
}: Props) {
  const groupText =
    minorsCount > 0
      ? `${adultsCount} adulto(s) y ${minorsCount} menor(es)`
      : `${adultsCount} adulto(s)`;

  return (
    <Html>
      <Head />
      <Preview>¡Ya hay plazas disponibles!</Preview>

      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Tailwind>
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow">
            <Section>
              <Text className="text-2xl font-bold text-slate-900">
                DeltaRoutes
              </Text>

              <Text className="text-slate-700">Hola {customerName},</Text>

              <Text className="text-slate-700">
                ✅ ¡Buenas noticias! Ya hay plazas suficientes para tu grupo en{" "}
                <span className="font-semibold">{activityLabel}</span>.
              </Text>

              <Section className="mt-4 rounded-xl bg-slate-50 p-4">
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Fecha:</span> {startText}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Grupo:</span> {groupText}{" "}
                  <span className="text-slate-500">({totalPax} en total)</span>
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Código:</span>{" "}
                  {reservationCode}
                </Text>
              </Section>

              <Text className="mt-6 text-slate-700">
                Para reservar, entra aquí:
              </Text>

              <Text className="text-slate-700">
                <a href={actionUrl} className="text-blue-600 underline">
                  {actionUrl}
                </a>
              </Text>

              <Hr className="my-6 border-slate-200" />

              <Text className="text-xs text-slate-400">
                Nota: las plazas pueden volver a agotarse si otras personas
                reservan antes.
              </Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}
