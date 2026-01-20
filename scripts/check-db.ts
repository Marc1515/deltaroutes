import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const users = await prisma.user.count();
  const experiences = await prisma.experience.count();
  const sessions = await prisma.session.count();

  console.log({ users, experiences, sessions });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
