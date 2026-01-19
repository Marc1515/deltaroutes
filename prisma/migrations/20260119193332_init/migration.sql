-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('BIKE_TOUR', 'KAYAK_TOUR', 'WALKING_TOUR', 'MINI_CRUISE');

-- CreateEnum
CREATE TYPE "LanguageBase" AS ENUM ('CA', 'ES', 'EN');

-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('CA', 'ES', 'EN', 'DE', 'FR', 'IT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GUIDE', 'STAFF');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HOLD', 'CONFIRMED', 'WAITING', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRES_PAYMENT', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('CUSTOMER', 'OPERATOR', 'WEATHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "languages" "LanguageCode"[] DEFAULT ARRAY[]::"LanguageCode"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ExperienceType" NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "difficulty" TEXT,
    "coverImage" TEXT,
    "location" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "supportedLanguages" "LanguageCode"[] DEFAULT ARRAY[]::"LanguageCode"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "meetingPoint" TEXT NOT NULL,
    "mapsUrl" TEXT,
    "maxSeatsTotal" INTEGER NOT NULL,
    "maxPerGuide" INTEGER NOT NULL,
    "bookingClosesAt" TIMESTAMP(3) NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "requiresPayment" BOOLEAN NOT NULL DEFAULT true,
    "refundFullBeforeHours" INTEGER NOT NULL DEFAULT 48,
    "refundPartialBeforeHours" INTEGER NOT NULL DEFAULT 24,
    "refundPartialPercent" INTEGER NOT NULL DEFAULT 50,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "guideUserId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HOLD',
    "holdExpiresAt" TIMESTAMP(3),
    "primaryLanguage" "LanguageBase" NOT NULL,
    "preferredLanguage" "LanguageCode",
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" "CancelReason",
    "refundAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeRefundId" TEXT,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Experience_slug_key" ON "Experience"("slug");

-- CreateIndex
CREATE INDEX "Session_experienceId_startAt_idx" ON "Session"("experienceId", "startAt");

-- CreateIndex
CREATE INDEX "Session_startAt_bookingClosesAt_idx" ON "Session"("startAt", "bookingClosesAt");

-- CreateIndex
CREATE INDEX "Reservation_sessionId_status_idx" ON "Reservation"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Reservation_sessionId_guideUserId_status_idx" ON "Reservation"("sessionId", "guideUserId", "status");

-- CreateIndex
CREATE INDEX "Reservation_status_holdExpiresAt_idx" ON "Reservation"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Reservation_cancelReason_cancelledAt_idx" ON "Reservation"("cancelReason", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_sessionId_customerId_key" ON "Reservation"("sessionId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key" ON "Payment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeRefundId_key" ON "Payment"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guideUserId_fkey" FOREIGN KEY ("guideUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
