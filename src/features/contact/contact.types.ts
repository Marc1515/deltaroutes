export const CONTACT_INQUIRY_TYPES = [
  "question",
  "group",
  "tailored",
] as const;

export type ContactInquiryType = (typeof CONTACT_INQUIRY_TYPES)[number];

export type ContactFormPayload = {
  name: string;
  email: string;
  phone: string;
  inquiryType: ContactInquiryType;
  groupSize: string;
  preferredDates: string;
  message: string;
  website: string;
};

export type ContactField = keyof ContactFormPayload;

export type ContactApiErrorCode =
  | "VALIDATION_ERROR"
  | "SPAM_DETECTED"
  | "RATE_LIMITED"
  | "CONFIGURATION_ERROR"
  | "SERVER_ERROR";

export type ContactApiResponse =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: {
        code: ContactApiErrorCode;
        message: string;
        fieldErrors?: Partial<Record<ContactField, string>>;
      };
      retryAfterSeconds?: number;
    };
