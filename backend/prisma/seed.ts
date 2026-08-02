import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Seed Admin Account ────────────────────────────────────────
  const adminEmail = 'admin@esports.com';
  const adminPassword = 'Admin@123';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedAdminPassword,
      role: Role.ADMIN,
    },
    create: {
      email: adminEmail,
      passwordHash: hashedAdminPassword,
      displayName: 'Admin Hệ Thống',
      role: Role.ADMIN,
    },
  });
  console.log(`  ✔ Admin account: ${adminEmail} / ${adminPassword}`);

  // ─── Seed Games ──────────────────────────────────────────────
  const games = [
    { name: 'League of Legends', teamSize: 5 },
    { name: 'Valorant', teamSize: 5 },
    { name: 'CS:GO', teamSize: 5 },
    { name: 'FC Online', teamSize: 1 },
    { name: 'Dota 2', teamSize: 5 },
    { name: 'Liên Quân Mobile', teamSize: 5 },
  ];

  for (const game of games) {
    await prisma.game.upsert({
      where: { name: game.name },
      update: {},
      create: game,
    });
    console.log(`  ✔ Game: ${game.name}`);
  }

  // ─── Seed Banned Keywords ────────────────────────────────────
  const bannedKeywords = [
    // Từ khóa cá độ
    { keyword: 'kèo', category: 'GAMBLING' as const },
    { keyword: 'tỷ lệ cược', category: 'GAMBLING' as const },
    { keyword: 'bet', category: 'GAMBLING' as const },
    { keyword: 'cá độ', category: 'GAMBLING' as const },
    { keyword: 'nhà cái', category: 'GAMBLING' as const },
    { keyword: 'casino', category: 'GAMBLING' as const },
    { keyword: 'đổi thưởng', category: 'GAMBLING' as const },
    { keyword: 'xóc đĩa', category: 'GAMBLING' as const },
    // Từ khóa thô tục
    { keyword: 'địt', category: 'PROFANITY' as const },
    { keyword: 'lồn', category: 'PROFANITY' as const },
    { keyword: 'đụ', category: 'PROFANITY' as const },
    { keyword: 'chó', category: 'PROFANITY' as const },
  ];

  for (const kw of bannedKeywords) {
    await prisma.bannedKeyword.upsert({
      where: { keyword: kw.keyword },
      update: {},
      create: kw,
    });
  }
  console.log(`  ✔ Banned keywords: ${bannedKeywords.length} items`);

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
