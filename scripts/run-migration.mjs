import pg from 'pg';
import { readFileSync } from 'fs';
import dns from 'dns';

// IPv4 강제
dns.setDefaultResultOrder('ipv4first');

const sql = readFileSync('supabase/migrations/001_init.sql', 'utf-8');
const password = process.argv[2];

const client = new pg.Client({
  host: 'db.eunsajtvsxdxfwdwmlwo.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: password,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log('Connecting...');
  await client.connect();
  console.log('Connected!');
  await client.query(sql);
  console.log('Migration 완료!');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await client.end();
}
