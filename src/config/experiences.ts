export type ExperienceKey = "WALK" | "BIKE" | "KAYAK" | "MINICRUISE";

export type ExperienceCard = {
    key: ExperienceKey;
    title: string;
    subtitle: string;
    // IMPORTANTE: aquí pon el experienceId real de tu BD
    experienceId: string;
};

export const EXPERIENCES: ExperienceCard[] = [
    {
        key: "WALK",
        title: "Ruta a pie",
        subtitle: "Explora a ritmo tranquilo.",
        experienceId: "cmlscl022000868vfdkoimkis",
    },
    {
        key: "BIKE",
        title: "Ruta en bici",
        subtitle: "Más distancia, mismas vistas.",
        experienceId: "cmlscl01o000668vf0ruu12eo",
    },
    {
        key: "KAYAK",
        title: "Ruta en kayak",
        subtitle: "Una experiencia en el agua.",
        experienceId: "cmlscl01w000768vfxbqw5jod",
    },
    {
        key: "MINICRUISE",
        title: "Mini-crucero",
        subtitle: "Relájate y disfruta.",
        experienceId: "cmlscl028000968vf91lkuvg5",
    },
];