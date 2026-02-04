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
  appUrl: string;
};

export default function TestEmail({ appUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Test de email de DeltaRoutes (Resend + React Email)</Preview>

      <Body style={{ backgroundColor: "#f6f9fc", margin: 0, padding: 0 }}>
        <Tailwind>
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white p-8 shadow">
            <Section>
              <Text className="text-2xl font-bold text-slate-900">
                DeltaRoutes
              </Text>

              <Text className="text-slate-700">
                Este es un email de prueba enviado con{" "}
                <span className="font-semibold">Resend</span> y{" "}
                <span className="font-semibold">React Email</span>.
              </Text>

              <Section className="mt-4 rounded-xl bg-slate-50 p-4">
                <Text className="m-0 text-slate-700">
                  ✅ Si estás leyendo esto, tu configuración de DNS + API Key
                  funciona.
                </Text>
              </Section>

              <Section className="mt-6 text-center">
                <Button
                  href={appUrl}
                  className="inline-block rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white"
                >
                  Abrir la app
                </Button>
              </Section>

              <Hr className="my-6 border-slate-200" />

              <Text className="text-xs text-slate-400">
                Email de prueba generado automáticamente desde tu entorno local.
              </Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  );
}
