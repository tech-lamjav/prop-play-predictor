#!/usr/bin/env node
/**
 * Aponta o localhost para staging ou para produção, e volta.
 *
 * Existe porque a alternativa é editar `.env.local` na mão toda vez, e editar
 * na mão é como se esquece de voltar. Esquecer de voltar significa desenvolver
 * contra o banco de produção sem perceber — e o CRM tem botão que escreve.
 *
 * O que ele troca são SÓ as duas variáveis que o navegador lê:
 * `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. As de servidor
 * (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`)
 * ficam como estão, apontando para staging de propósito: assim um script de
 * manutenção rodado sem pensar não acerta produção.
 *
 * ⚠️ Com produção ligada, o CRM escreve em produção de verdade. Mudar etapa,
 * anotar, dar acesso, conceder assinatura — tudo vale. Ler é seguro; clicar
 * não é ensaio.
 *
 *   node scripts/apontar-ambiente.mjs producao
 *   node scripts/apontar-ambiente.mjs staging
 *   node scripts/apontar-ambiente.mjs             (diz onde está)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ENV = path.join(RAIZ, '.env.local');

const PROJETOS = {
  staging: { ref: 'kpbjuplcwiyrymafhehz', nome: 'staging' },
  producao: { ref: 'lavclmlvvfzkblrstojd', nome: 'PRODUÇÃO' },
};

/** As chaves de um projeto, pedidas ao Supabase. Nunca impressas. */
function chaveAnon(ref, token) {
  const saida = execFileSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', ref, '--output', 'json'],
    { env: { ...process.env, SUPABASE_ACCESS_TOKEN: token }, encoding: 'utf8', shell: true },
  );
  const chaves = JSON.parse(saida);
  const anon = chaves.find((c) => c.name === 'anon');
  if (!anon) throw new Error(`projeto ${ref} não devolveu a chave anon`);
  return anon.api_key;
}

function lerEnv() {
  const linhas = fs.readFileSync(ENV, 'utf8').split(/\r?\n/);
  const valor = (nome) => {
    const l = linhas.find((x) => x.startsWith(`${nome}=`));
    return l ? l.slice(nome.length + 1).trim() : '';
  };
  return { linhas, valor };
}

function ondeEstou() {
  const { valor } = lerEnv();
  const url = valor('VITE_SUPABASE_URL');
  for (const [chave, p] of Object.entries(PROJETOS)) {
    if (url.includes(p.ref)) return { chave, ...p };
  }
  return { chave: 'desconhecido', nome: `desconhecido (${url})`, ref: '' };
}

const alvo = process.argv[2];

if (!alvo) {
  console.log(`O localhost está apontando para: ${ondeEstou().nome}`);
  process.exit(0);
}

const projeto = PROJETOS[alvo];
if (!projeto) {
  console.error(`Ambiente "${alvo}" não existe. Use: staging | producao`);
  process.exit(1);
}

const { linhas, valor } = lerEnv();
const token = valor('SUPABASE_ACCESS_TOKEN');
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN no .env.local.');
  process.exit(1);
}

// Guarda uma cópia antes de mexer, uma vez só. Se já existe, é de uma troca
// anterior e vale mais que a de agora: ela é o estado original.
const copia = `${ENV}.backup`;
if (!fs.existsSync(copia)) fs.copyFileSync(ENV, copia);

const anon = chaveAnon(projeto.ref, token);
const url = `https://${projeto.ref}.supabase.co`;

const novas = linhas.map((l) => {
  if (l.startsWith('VITE_SUPABASE_URL=')) return `VITE_SUPABASE_URL=${url}`;
  if (l.startsWith('VITE_SUPABASE_ANON_KEY=')) return `VITE_SUPABASE_ANON_KEY=${anon}`;
  return l;
});

fs.writeFileSync(ENV, novas.join('\n'));

console.log(`O navegador passa a ler: ${projeto.nome}`);
console.log('Reinicie o `npm run dev` — o Vite lê o .env só no start.');
if (alvo === 'producao') {
  console.log('');
  console.log('⚠️  É produção. Toda escrita do CRM vale de verdade:');
  console.log('   mudar etapa, anotar, dar acesso, conceder assinatura.');
  console.log('   Para voltar: node scripts/apontar-ambiente.mjs staging');
}
