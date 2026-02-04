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
  languageLabel: string;
  reservationCode: string;
  amountText: string;
};

export default function PaymentConfirmedEmail({
  customerName,
  activityLabel,
  startText,
  languageLabel,
  reservationCode,
  amountText,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Pago confirmado — reserva confirmada</Preview>

      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Tailwind>
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow">
            <Section>
              <Text className="text-2xl font-bold text-slate-900">
                DeltaRoutes
              </Text>

              <Text className="text-slate-700">Hola {customerName},</Text>

              <Text className="text-slate-700">
                ✅ Hemos recibido tu pago. Tu reserva está{" "}
                <span className="font-semibold">confirmada</span>.
              </Text>

              <Section className="mt-4 rounded-xl bg-slate-50 p-4">
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Actividad:</span>{" "}
                  {activityLabel}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Fecha:</span> {startText}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Idioma:</span> {languageLabel}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Importe:</span> {amountText}
                </Text>
                <Text className="m-0 text-slate-700">
                  <span className="font-semibold">Código:</span>{" "}
                  {reservationCode}
                </Text>
              </Section>

              <Hr className="my-6 border-slate-200" />

              <Text className="text-xs text-slate-400">
                Gracias por reservar con DeltaRoutes. Si necesitas ayuda,
                responde a este email.
              </Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}
