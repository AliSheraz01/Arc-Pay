import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({ url: 'file:../dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.transaction.count();
  console.log('Transaction count:', count);
  
  const txs = await prisma.transaction.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log('Recent TXs:', txs);

  const state = await prisma.syncState.findMany();
  console.log('SyncState:', state);
}

main().catch(console.error);
