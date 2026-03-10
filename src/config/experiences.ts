export type ExperienceKey = "WALK" | "BIKE" | "KAYAK" | "MINICRUISE";

export type ExperienceCard = {
    key: ExperienceKey;
    title: string;
    subtitle: string;
    // IMPORTANTE: aquí pon el experienceId real de tu BD
    experienceId: string;
    imageSrc: string;
    imageAlt: string;
};

export const EXPERIENCES: ExperienceCard[] = [
    {
        key: "WALK",
        title: "Ruta a pie",
        subtitle: "Explora a ritmo tranquilo.",
        experienceId: "cmlscl022000868vfdkoimkis",
        imageSrc: "/img/hiking.jpg",
        imageAlt: "Personas haciendo senderismo junto al delta",
    },
    {
        key: "BIKE",
        title: "Ruta en bici",
        subtitle: "Más distancia, mismas vistas.",
        experienceId: "cmlscl01o000668vf0ruu12eo",
        imageSrc: "/img/cycling2.jpg",
        imageAlt: "Ruta en bicicleta por caminos del delta",
    },
    {
        key: "KAYAK",
        title: "Ruta en kayak",
        subtitle: "Una experiencia en el agua.",
        experienceId: "cmlscl01w000768vfxbqw5jod",
        imageSrc: "/img/kayak2.jpg",
        imageAlt: "Personas en kayak navegando por el agua",
    },
    {
        key: "MINICRUISE",
        title: "Mini-crucero",
        subtitle: "Relájate y disfruta.",
        experienceId: "cmlscl028000968vf91lkuvg5",
        imageSrc: "/img/cruise2.jpg",
        imageAlt: "Barco de crucero navegando por el delta",
    },
];