// Aplica um arquivo .sql no Supabase de DEV.
//
// Existe porque o banco de dev não aplica as migrations do repositório sozinho:
// toda migration nova precisa ser rodada na mão, e esquecer disso deixa o dev
// fora de sincronia sem erro visível na tela.
//
// Uso:  node scripts/apply-sql-dev.mjs supabase/migrations/<arquivo>.sql
//
// Credencial: SUPABASE_ACCESS_TOKEN no .env.local (token pessoal sbp_ da API de
// gerenciamento). A service role key não serve aqui — PostgREST não roda DDL, e
// este projeto não tem a função execute_sql.
//
// Trava de segurança: só roda contra o projeto de dev. Para qualquer outro,
// aborta — produção continua sendo deploy manual e consciente.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEV_PROJECT_REF = 'kpbjuplcwiyrymafhehz';

function readEnvLocal(key) {
  const env = readFileSync(resolve('.env.local'), 'utf8');
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^"|"$/g, '') : null;
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error('Informe o arquivo .sql. Ex.: node scripts/apply-sql-dev.mjs supabase/migrations/x.sql');
  process.exit(1);
}

const url = (readEnvLocal('SUPABASE_URL') || '').replace(/\/$/, '');
if (!url.includes(DEV_PROJECT_REF)) {
  console.error(`Este script só roda contra o projeto de dev (${DEV_PROJECT_REF}). Alvo encontrado: ${url}`);
  process.exit(1);
}

const token = readEnvLocal('SUPABASE_ACCESS_TOKEN');
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN no .env.local (token pessoal sbp_ do Supabase).');
  process.exit(1);
}

const sql = readFileSync(resolve(sqlPath), 'utf8');
console.log(`Aplicando ${sqlPath} em ${DEV_PROJECT_REF}...`);

const response = await fetch(`https://api.supabase.com/v1/projects/${DEV_PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Falhou (HTTP ${response.status}): ${body.slice(0, 400)}`);
  process.exit(1);
}
console.log(`OK (HTTP ${response.status}). ${body.slice(0, 200)}`);
