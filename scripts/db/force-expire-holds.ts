import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
    const nowMinus = new Date(Date.now() - 60_000); // hace 1 minuto

    const updated = await prisma.reservation.updateMany({
        where: { status: "HOLD" },
        data: { holdExpiresAt: nowMinus },
    });

    console.log("HOLD reservations forced to expired time:", updated.count);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
