const DEFAULT_CONTACT_EMAIL_SUBJECT_PREFIX = "DeltaRoutes · Contacto";

export type ContactEmailConfig = {
  to: string;
  subjectPrefix: string;
};

export const CONTACT_EMAIL_ENV_VARS = {
  to: "CONTACT_EMAIL_TO",
  subjectPrefix: "CONTACT_EMAIL_SUBJECT_PREFIX",
  emailFrom: "EMAIL_FROM",
  resendApiKey: "RESEND_API_KEY",
} as const;

type ContactEmailConfigResult =
  | {
      ok: true;
      config: ContactEmailConfig;
    }
  | {
      ok: false;
      message: string;
    };

function readTrimmedEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getContactEmailConfig(): ContactEmailConfigResult {
  const to = readTrimmedEnv(CONTACT_EMAIL_ENV_VARS.to);
  if (!to) {
    return {
      ok: false,
      message: `Missing ${CONTACT_EMAIL_ENV_VARS.to} env var`,
    };
  }

  const subjectPrefix =
    readTrimmedEnv(CONTACT_EMAIL_ENV_VARS.subjectPrefix) ||
    DEFAULT_CONTACT_EMAIL_SUBJECT_PREFIX;

  return {
    ok: true,
    config: {
      to,
      subjectPrefix,
    },
  };
}
