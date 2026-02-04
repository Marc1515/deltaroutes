import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

type Props = {
  customerName: string;
  activityLabel: string;
  startText: string;
  languageLabel: string;
  payUrl: string;
  holdMinutes: number;
  reservationCode: string;
};

export default function ReservationCreatedHoldEmail({
  customerName,
  activityLabel,
  startText,
  languageLabel,
  payUrl,
  holdMinutes,
  reservationCode,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>
        Reserva iniciada — completa el pago en {holdMinutes.toString()} min
      </Preview>

      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Tailwind>
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow">
            <Section>
              <Text className="text-2xl font-bold text-slate-900">
                DeltaRoutes
              </Text>

              <Text className="text-slate-700">Hola {customerName},</Text>

              <Text className="text-slate-700">
                Hemos reservado tu plaza para{" "}
                <span className="font-semibold">{activityLabel}</span>.
              </Text>

              <Section className="mt-4 rounded-xl bg-slate-50 p-4">
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Fecha:</span> {startText}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Idioma:</span> {languageLabel}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Código:</span>{" "}
                  {reservationCode}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Tiempo para pagar:</span>{" "}
                  {holdMinutes} min
                </Text>
              </Section>

              <Section className="mt-6 text-center">
                <Button
                  href={payUrl}
                  className="inline-block rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white"
                >
                  Completar pago
                </Button>
              </Section>

              <Text className="mt-6 text-sm text-slate-500">
                Si no completas el pago a tiempo, la reserva caducará
                automáticamente.
              </Text>

              <Hr className="my-6 border-slate-200" />

              <Text className="text-xs text-slate-400">
                Si no has solicitado esta reserva, puedes ignorar este correo.
              </Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}
