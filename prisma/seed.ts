// prisma/seed.ts
import { ExperienceType, UserRole, LanguageCode } from "../src/generated/prisma";
import {prisma} from "../src/lib/prisma";



function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function setTime(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  // --- Admin ---
  await prisma.user.upsert({
    where: { email: "admin@deltaroutes.local" },
    update: { name: "Admin", role: UserRole.ADMIN, isActive: true },
    create: { email: "admin@deltaroutes.local", name: "Admin", role: UserRole.ADMIN },
  });

  // --- Guides (5) ---
  const guidesData = [
    {
      email: "guide1@deltaroutes.local",
      name: "Marc (Guía)",
      languages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN],
    },
    {
      email: "guide2@deltaroutes.local",
      name: "Laura (Guía)",
      languages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN],
    },
    {
      email: "guide3@deltaroutes.local",
      name: "Eric (Guía)",
      languages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN, LanguageCode.DE], // extra
    },
    {
      email: "guide4@deltaroutes.local",
      name: "Núria (Guía)",
      languages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN],
    },
    {
      email: "guide5@deltaroutes.local",
      name: "Pol (Guía)",
      languages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN],
    },
  ];

  for (const g of guidesData) {
    await prisma.user.upsert({
      where: { email: g.email },
      update: {
        name: g.name,
        role: UserRole.GUIDE,
        isActive: true,
        languages: g.languages,
      },
      create: {
        email: g.email,
        name: g.name,
        role: UserRole.GUIDE,
        isActive: true,
        languages: g.languages,
      },
    });
  }

  // --- Experiences (4) ---
  const experiences = [
    {
      slug: "tour-bici-arrozales-deltebre",
      title: "Tour guiado en bici: arrozales y miradores",
      description:
        "Ruta guiada suave ideal para grupos, con paradas para fotos y explicación del entorno del Delta.",
      type: ExperienceType.BIKE_TOUR,
      durationMin: 120,
      difficulty: "Fácil",
      location: "Deltebre",
      isPublished: true,
      supportedLanguages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN],
      coverImage: null,
    },
    {
      slug: "kayak-sunset-amposta",
      title: "Kayak al atardecer: el Delta desde el agua",
      description:
        "Salida guiada en kayak con ambiente tranquilo, perfecta para ver el atardecer y fauna local.",
      type: ExperienceType.KAYAK_TOUR,
      durationMin: 90,
      difficulty: "Fácil",
      location: "Amposta",
      isPublished: true,
      supportedLanguages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN, LanguageCode.DE],
      coverImage: null,
    },
    {
      slug: "tour-a-pie-sant-jaume",
      title: "Tour a pie: senderos y naturaleza del Delta",
      description:
        "Caminata guiada con puntos panorámicos y explicación del ecosistema. Recomendado para amantes de la naturaleza.",
      type: ExperienceType.WALKING_TOUR,
      durationMin: 150,
      difficulty: "Media",
      location: "Sant Jaume d'Enveja",
      isPublished: true,
      supportedLanguages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN],
      coverImage: null,
    },
    {
      slug: "mini-crucero-rio-extranjeros",
      title: "Mini-crucero por el río: historia y paisajes",
      description:
        "Recorrido guiado en mini-crucero, muy popular para visitantes internacionales.",
      type: ExperienceType.MINI_CRUISE,
      durationMin: 60,
      difficulty: "Fácil",
      location: "Amposta",
      isPublished: true,
      supportedLanguages: [LanguageCode.CA, LanguageCode.ES, LanguageCode.EN, LanguageCode.DE],
      coverImage: null,
    },
  ];

  const createdExperiences = [];
  for (const exp of experiences) {
    const e = await prisma.experience.upsert({
      where: { slug: exp.slug },
      update: exp,
      create: exp,
    });
    createdExperiences.push(e);
  }

  // --- Sessions (3 por experiencia) ---
  // Reglas:
  // - bookingClosesAt = startAt - 4h
  // - priceCents y capacidades distintas
  const now = new Date();
  const sessionDays = [2, 5, 8];

  for (const exp of createdExperiences) {
    for (const d of sessionDays) {
      const day = addDays(now, d);

      // Horarios distintos para variedad
      const startAt = setTime(day, exp.type === ExperienceType.MINI_CRUISE ? 12 : 18, 0);

      const durationMin =
        exp.type === ExperienceType.WALKING_TOUR ? 150 : exp.durationMin;

      const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      const bookingClosesAt = new Date(startAt.getTime() - 4 * 60 * 60 * 1000);

      const isMiniCruise = exp.type === ExperienceType.MINI_CRUISE;
      const isKayak = exp.type === ExperienceType.KAYAK_TOUR;

      const maxSeatsTotal = isMiniCruise ? 20 : isKayak ? 12 : 16;
      const maxPerGuide = isMiniCruise ? 20 : 6;

      const priceCents = isMiniCruise ? 2500 : isKayak ? 3500 : 2000;

      await prisma.session.create({
        data: {
          experienceId: exp.id,
          startAt,
          endAt,
          meetingPoint: "Punto de encuentro por confirmar (añadir Maps URL en edición)",
          mapsUrl: null,
          maxSeatsTotal,
          maxPerGuide,
          bookingClosesAt,
          priceCents,
          currency: "eur",
          requiresPayment: true,
          // política por defecto: 48/24/50 ya viene por defaults
        },
      });
    }
  }

  console.log("✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
