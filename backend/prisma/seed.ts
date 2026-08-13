import { PrismaClient, Role, GameGenre } from '@prisma/client';
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
  // positions: danh sách vị trí thi đấu hợp lệ, FE dùng render dropdown động
  const games = [
    {
      name: 'League of Legends',
      genre: GameGenre.MOBA,
      positions: ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'],
      defaultTeamSize: 5,
      minTeamSize: 5,
      maxTeamSize: 7,
    },
    {
      name: 'Liên Quân Mobile',
      genre: GameGenre.MOBA,
      positions: [
        'ĐƯỜNG RỒNG',
        'ĐI RỪNG',
        'ĐƯỜNG GIỮA',
        'ĐƯỜNG QUÁI',
        'HỖ TRỢ',
      ],
      defaultTeamSize: 5,
      minTeamSize: 5,
      maxTeamSize: 7,
    },
    {
      name: 'Dota 2',
      genre: GameGenre.MOBA,
      positions: ['CARRY', 'MID', 'OFFLANE', 'SOFT SUPPORT', 'HARD SUPPORT'],
      defaultTeamSize: 5,
      minTeamSize: 5,
      maxTeamSize: 7,
    },
    {
      name: 'Valorant',
      genre: GameGenre.FPS,
      positions: ['IGL', 'ENTRY', 'SUPPORT', 'LURKER', 'SENTINEL'],
      defaultTeamSize: 5,
      minTeamSize: 5,
      maxTeamSize: 7,
    },
    {
      name: 'CS:GO',
      genre: GameGenre.FPS,
      positions: ['IGL', 'ENTRY', 'SUPPORT', 'LURKER', 'AWPER'],
      defaultTeamSize: 5,
      minTeamSize: 5,
      maxTeamSize: 7,
    },
    {
      name: 'PUBG Mobile',
      genre: GameGenre.BATTLE_ROYALE,
      positions: ['IGL', 'FRAGGER', 'SUPPORT', 'SCOUT'],
      defaultTeamSize: 4,
      minTeamSize: 4,
      maxTeamSize: 6,
    },
    {
      name: 'FC Online',
      genre: GameGenre.SPORTS,
      positions: [], // game solo, không có vị trí
      defaultTeamSize: 1,
      minTeamSize: 1,
      maxTeamSize: 1,
    },
  ];

  for (const game of games) {
    await prisma.game.upsert({
      where: { name: game.name },
      update: {
        genre: game.genre,
        positions: game.positions,
        defaultTeamSize: game.defaultTeamSize,
        minTeamSize: game.minTeamSize,
        maxTeamSize: game.maxTeamSize,
      },
      create: game,
    });
    console.log(`  ✔ Game: ${game.name} (${game.genre})`);
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
    // Liên kết độc hại / lừa đảo
    { keyword: 'malware', category: 'MALICIOUS_LINK' as const },
    { keyword: 'phishing', category: 'MALICIOUS_LINK' as const },
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
