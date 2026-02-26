// src/emails/ReservationAvailabilityEmail.tsx
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
  Link,
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

  // opcional (si luego quieres añadirlo): minutos de hold / fecha límite
  // deadlineText?: string;
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
      {/* Preview más “operativo” */}
      <Preview>
        Acción requerida: reserva disponible ({reservationCode})
      </Preview>

      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Tailwind>
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow">
            <Section>
              <Text className="text-2xl font-bold text-slate-900">
                DeltaRoutes
              </Text>

              <Text className="text-slate-700">Hola {customerName},</Text>

              {/* Sin emojis / sin “buenas noticias” */}
              <Text className="text-slate-700">
                Tu reserva en lista de espera ya puede completarse para{" "}
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

              {/* CTA menos “marketing” */}
              <Text className="mt-6 text-slate-700">
                Para continuar con la reserva:
              </Text>

              <Text className="text-slate-700">
                <Link href={actionUrl} className="text-blue-600 underline">
                  Abrir reserva
                </Link>
              </Text>

              {/* Si quieres, también puedes incluir el link completo pero en texto gris pequeño,
                  aunque mejor evitarlo si quieres reducir Promociones */}
              {/* <Text className="text-xs text-slate-400 break-all">{actionUrl}</Text> */}

              <Hr className="my-6 border-slate-200" />

              <Text className="text-xs text-slate-400">
                Nota: la disponibilidad puede cambiar si otras personas reservan
                antes.
              </Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}
