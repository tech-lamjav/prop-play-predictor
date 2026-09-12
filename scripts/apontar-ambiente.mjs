#!/usr/bin/env node
/**
 * Aponta o localhost para staging ou para produção, e volta.
 *
 * Existe porque a alternativa é editar env na mão toda vez, e editar na mão é
 * como se esquece de voltar. Esquecer de voltar significa desenvolver contra o
 * banco de produção sem perceber — e o CRM tem botão que escreve.
 *
 * ⚠️ Escreve em `.env.development.local`, e NÃO em `.env.local`. A primeira
 * versão mexia no `.env.local` e não surtia efeito nenhum: o Vite dá prioridade
 * ao arquivo do MODO sobre o local genérico, nesta ordem, do mais forte para o
 * mais fraco:
 *
 *     .env.development.local  >  .env.development  >  .env.local  >  .env
 *
 * Como o repositório já tem um `.env.development` apontando para staging, tudo
 * que se escrevia no `.env.local` era ignorado. O sintoma foi o navegador
 * continuar falando com staging depois da troca, o que é pior que não trocar:
 * a tela diz uma coisa e o banco é outro.
 *
 * Voltar para staging APAGA o arquivo, em vez de reescrevê-lo com os valores de
 * staging. Assim o estado de "voltei ao normal" é a ausência de arquivo, e não
 * um arquivo que alguém precisa conferir se está certo.
 *
 * O que ele troca são só as duas variáveis que o navegador lê. As de servidor
 * (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`) ficam
 * onde estão, em staging: um script de manutenção rodado sem pensar não acerta
 * produção.
 *
 * ⚠️ Com produção ligada, o CRM escreve em produção de verdade. Mudar etapa,
 * anotar, dar acesso, conceder assinatura — tudo vale.
 *
 *   node scripts/apontar-ambiente.mjs producao
 *   node scripts/apontar-ambiente.mjs staging
 *   node scripts/apontar-ambiente.mjs             (diz onde está)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
/** O arquivo que o Vite obedece acima de todos, e que o .gitignore já cobre. */
const ALVO = path.join(RAIZ, '.env.development.local');

const PROJETOS = {
  staging: { ref: 'kpbjuplcwiyrymafhehz', nome: 'staging' },
  producao: { ref: 'lavclmlvvfzkblrstojd', nome: 'PRODUÇÃO' },
};

/** Um valor de qualquer arquivo de env do projeto. */
function doEnv(arquivo, nome) {
  const caminho = path.join(RAIZ, arquivo);
  if (!fs.existsSync(caminho)) return '';
  const linha = fs
    .readFileSync(caminho, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${nome}=`));
  return linha ? linha.slice(nome.length + 1).trim() : '';
}

/** A chave anon de um projeto, pedida ao Supabase. Nunca impressa. */
function chaveAnon(ref, token) {
  const saida = execFileSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', ref, '--output', 'json'],
    { env: { ...process.env, SUPABASE_ACCESS_TOKEN: token }, encoding: 'utf8', shell: true },
  );
  const anon = JSON.parse(saida).find((c) => c.name === 'anon');
  if (!anon) throw new Error(`projeto ${ref} não devolveu a chave anon`);
  return anon.api_key;
}

function ondeEstou() {
  // A mesma cascata do Vite, de cima para baixo: o primeiro que tiver a
  // variável é o que vale.
  for (const arquivo of ['.env.development.local', '.env.development', '.env.local', '.env']) {
    const url = doEnv(arquivo, 'VITE_SUPABASE_URL');
    if (!url) continue;
    const achado = Object.values(PROJETOS).find((p) => url.includes(p.ref));
    return { nome: achado?.nome ?? `desconhecido (${url})`, arquivo };
  }
  return { nome: 'nenhum arquivo de env define a URL', arquivo: '—' };
}

const alvo = process.argv[2];

if (!alvo) {
  const onde = ondeEstou();
  console.log(`O localhost está apontando para: ${onde.nome}`);
  console.log(`Quem manda agora: ${onde.arquivo}`);
  process.exit(0);
}

if (alvo === 'staging') {
  if (fs.existsSync(ALVO)) fs.rmSync(ALVO);
  console.log('Voltou ao normal: o .env.development.local foi apagado,');
  console.log('e o .env.development do repositório volta a valer (staging).');
  console.log('Reinicie o `npm run dev`.');
  process.exit(0);
}

const projeto = PROJETOS[alvo];
if (!projeto) {
  console.error(`Ambiente "${alvo}" não existe. Use: staging | producao`);
  process.exit(1);
}

const token = doEnv('.env.local', 'SUPABASE_ACCESS_TOKEN');
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN no .env.local.');
  process.exit(1);
}

const anon = chaveAnon(projeto.ref, token);

fs.writeFileSync(
  ALVO,
  [
    '# Gerado por scripts/apontar-ambiente.mjs. NÃO comitar.',
    '# Apague este arquivo (ou rode o script com `staging`) para voltar ao normal.',
    `VITE_SUPABASE_URL=https://${projeto.ref}.supabase.co`,
    `VITE_SUPABASE_ANON_KEY=${anon}`,
    '',
  ].join('\n'),
);

console.log(`O navegador passa a ler: ${projeto.nome}`);
console.log('Reinicie o `npm run dev` — o Vite lê o env só no start.');
console.log('');
console.log('⚠️  É produção. Toda escrita do CRM vale de verdade:');
console.log('   mudar etapa, anotar, dar acesso, conceder assinatura.');
console.log('   Para voltar: node scripts/apontar-ambiente.mjs staging');
