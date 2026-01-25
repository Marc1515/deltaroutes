import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
    const users = await prisma.user.count();
    const experiences = await prisma.experience.count();
    const sessions = await prisma.session.count();
    const reservations = await prisma.reservation.count();
    const payments = await prisma.payment.count();

    console.log({ users, experiences, sessions, reservations, payments });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
