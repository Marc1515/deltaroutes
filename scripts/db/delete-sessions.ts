import "dotenv/config";
import { prisma } from "../../src/lib/prisma";

async function main() {
    const result = await prisma.session.deleteMany();

    console.log({
        deletedCount: result.count,
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

