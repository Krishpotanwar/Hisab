/**
 * HisaabKitab — Test Data Seed Script
 * ====================================
 * Creates 3 test users, a shared group, sample expenses, and a friendship.
 *
 * Prerequisites:
 *   1. Copy .env.example → .env.local and fill in your Supabase project URL + service role key
 *   2. Run:  npx tsx scripts/seed-test-data.ts
 *
 * Test accounts created:
 *   test1@hisaab.dev  /  Test1234!
 *   test2@hisaab.dev  /  Test1234!
 *   test3@hisaab.dev  /  Test1234!
 *
 * ⚠️  Uses the SERVICE ROLE key — only run in development/staging.
 *     Never expose the service role key in a browser or commit it to git.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from .env.local in project root
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('    Set SUPABASE_SERVICE_ROLE_KEY in .env.local (find it in Supabase Dashboard → Settings → API → service_role)');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TEST_USERS = [
  { email: 'test1@hisaab.dev', password: 'Test1234!', full_name: 'Alice Test' },
  { email: 'test2@hisaab.dev', password: 'Test1234!', full_name: 'Bob Test' },
  { email: 'test3@hisaab.dev', password: 'Test1234!', full_name: 'Charlie Test' },
];

async function upsertUser(email: string, password: string, full_name: string) {
  // Try to create; if exists, fetch
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error) {
    if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
      // Find existing user
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (existing) {
        console.log(`  ℹ️  User already exists: ${email} (id: ${existing.id})`);
        return existing;
      }
    }
    throw new Error(`Failed to create ${email}: ${error.message}`);
  }

  console.log(`  ✅  Created user: ${email} (id: ${data.user.id})`);

  // Upsert profile
  await admin.from('profiles').upsert({
    id: data.user.id,
    full_name,
    avatar_url: null,
  });

  return data.user;
}

async function main() {
  console.log('\n🌱  HisaabKitab Test Data Seed\n');

  // 1. Create users
  console.log('1️⃣   Creating test users...');
  const users = await Promise.all(
    TEST_USERS.map((u) => upsertUser(u.email, u.password, u.full_name)),
  );
  const [alice, bob, charlie] = users;

  // 2. Create a group (Alice is creator)
  console.log('\n2️⃣   Creating test group...');
  const { data: group, error: groupErr } = await admin
    .from('groups')
    .insert({
      name: '🏖️ Goa Trip',
      description: 'Test group for Goa trip expenses',
      icon: '🏖️',
      currency: 'INR',
      created_by: alice.id,
    })
    .select()
    .single();

  if (groupErr) throw new Error(`Group creation failed: ${groupErr.message}`);
  console.log(`  ✅  Group created: "${group.name}" (id: ${group.id})`);

  // 3. Add all 3 users as group members
  console.log('\n3️⃣   Adding members to group...');
  await admin.from('group_members').upsert([
    { group_id: group.id, user_id: alice.id },
    { group_id: group.id, user_id: bob.id },
    { group_id: group.id, user_id: charlie.id },
  ]);
  console.log('  ✅  Alice, Bob, Charlie added to group');

  // 4. Add sample expenses
  console.log('\n4️⃣   Adding sample expenses...');

  // Expense 1: Alice paid ₹3000 hotel, split 3 ways (₹1000 each)
  const { data: expense1 } = await admin
    .from('expenses')
    .insert({
      group_id: group.id,
      description: 'Hotel stay',
      amount: 3000,
      paid_by: alice.id,
      split_type: 'equal',
      created_by: alice.id,
    })
    .select()
    .single();

  if (expense1) {
    await admin.from('expense_splits').insert([
      { expense_id: expense1.id, user_id: alice.id, amount: 1000 },
      { expense_id: expense1.id, user_id: bob.id, amount: 1000 },
      { expense_id: expense1.id, user_id: charlie.id, amount: 1000 },
    ]);
    console.log(`  ✅  Expense 1: Alice paid ₹3000 for hotel (split equally)`);
  }

  // Expense 2: Bob paid ₹600 dinner, split 3 ways (₹200 each)
  const { data: expense2 } = await admin
    .from('expenses')
    .insert({
      group_id: group.id,
      description: 'Beach dinner',
      amount: 600,
      paid_by: bob.id,
      split_type: 'equal',
      created_by: bob.id,
    })
    .select()
    .single();

  if (expense2) {
    await admin.from('expense_splits').insert([
      { expense_id: expense2.id, user_id: alice.id, amount: 200 },
      { expense_id: expense2.id, user_id: bob.id, amount: 200 },
      { expense_id: expense2.id, user_id: charlie.id, amount: 200 },
    ]);
    console.log(`  ✅  Expense 2: Bob paid ₹600 for dinner (split equally)`);
  }

  // 5. Create a friendship between Alice and Bob
  console.log('\n5️⃣   Creating friend request (Alice → Bob)...');
  await admin.from('friendships').upsert({
    requester_id: alice.id,
    recipient_id: bob.id,
    status: 'accepted',
  });
  console.log('  ✅  Alice and Bob are now friends');

  // 6. Summary
  console.log('\n🎉  Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test Accounts:');
  TEST_USERS.forEach((u) => {
    console.log(`  ${u.email}  /  ${u.password}`);
  });
  console.log(`\nTest Group: "${group.name}" (id: ${group.id})`);
  console.log('\nExpected balances:');
  console.log('  Alice:   paid ₹3000, owes ₹200  → net +₹2600');
  console.log('  Bob:     paid ₹600,  owes ₹1200 → net -₹600');
  console.log('  Charlie: paid ₹0,    owes ₹1200 → net -₹1200');
  console.log('\nInvite link to join the group:');
  console.log(`  ${SUPABASE_URL.replace('.supabase.co', '')}/join/${group.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
