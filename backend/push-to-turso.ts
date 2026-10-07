import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function main() {
  // Read schema from local dev.db (created by prisma db push at project root)
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  console.log(`Reading local db from: ${dbPath}`);
  const localDb = createClient({ url: 'file:' + dbPath });
  
  const result = await localDb.execute(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY type DESC"
  );

  const statements = result.rows.map((r: any) => r.sql as string).filter(Boolean);
  localDb.close();

  console.log(`Found ${statements.length} schema statements from local db.\n`);

  if (statements.length === 0) {
    console.log('No statements found! Trying root dev.db...');
    const rootDb = createClient({ url: 'file:' + path.join(process.cwd(), 'dev.db') });
    const rootResult = await rootDb.execute(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY type DESC"
    );
    const rootStatements = rootResult.rows.map((r: any) => r.sql as string).filter(Boolean);
    rootDb.close();
    console.log(`Found ${rootStatements.length} statements from root dev.db.\n`);
    if (rootStatements.length > 0) {
      statements.push(...rootStatements);
    }
  }

  // Connect to remote Turso
  const turso = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log('Connected to Turso. Applying schema...\n');

  for (const sql of statements) {
    const preview = sql.substring(0, 100).replace(/\n/g, ' ');
    try {
      await turso.execute(sql);
      console.log(`  ✅ ${preview}...`);
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`  ⏭️  Already exists: ${preview}...`);
      } else {
        console.error(`  ❌ Failed: ${preview}...`);
        console.error(`     ${e.message}`);
      }
    }
  }

  console.log('\n🎉 Schema push to Turso complete!');
  turso.close();
}

main().catch(e => { console.error(e); process.exit(1); });
