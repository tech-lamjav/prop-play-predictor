import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';
import { TIPOS_DE_ANOTACAO } from './crm-vocabulario';

// ============================================================================
// Quem escreveu não pode ser dito pelo cliente
// ============================================================================
// A tabela `crm_anotacao` já tinha política de sócio desde a migration 123.
// Esta função existe por um motivo só: carimbar o autor com `auth.uid()`. Com
// insert direto do navegador, um sócio poderia gravar uma anotação em nome do
// outro — e numa lista que existe justamente para saber quem falou com quem,
// isso é o registro mentindo.
// ============================================================================

const MIGRATION = lerMigration('20260911140000_126_crm_anotar.sql');
const FUNCAO = comando(MIGRATION, /create or replace function public\.crm_anotar/, '$function$;');

describe('crm_anotar', () => {
  it('existe', () => {
    expect(FUNCAO).not.toBeNull();
  });

  it('o autor vem do banco, e não dos parâmetros', () => {
    const assinatura = MIGRATION.match(/crm_anotar\(([^)]*)\)/);
    expect(assinatura![1]).not.toMatch(/por|autor|quem/i);
    const insert = comando(FUNCAO ?? '', /insert into public\.crm_anotacao/);
    expect(insert).toMatch(/\(select auth\.uid\(\)\)/);
  });

  it('confere o portão por dentro', () => {
    expect(FUNCAO).toMatch(/if not public\.eh_socio\(\)/);
  });

  it('roda como dono do banco, com search_path travado', () => {
    expect(FUNCAO).toMatch(/security definer/);
    expect(FUNCAO).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_anotar/);
  });

  it('recusa texto em branco, e não só string vazia', () => {
    // A tela também trava o botão, mas ela é UM caminho até a tabela, não o
    // único: qualquer sócio com o cliente na mão escreve direto.
    expect(FUNCAO).toMatch(/btrim\(coalesce\(p_texto, ''\)\)/);
    expect(FUNCAO).toMatch(/if v_texto = '' then/);
  });

  it('grava o texto já aparado', () => {
    // Guardar o espaço em branco faria a lista desenhar recuos que ninguém
    // escreveu de propósito.
    const insert = comando(FUNCAO ?? '', /insert into public\.crm_anotacao/);
    expect(insert).toMatch(/v_texto/);
    expect(insert).not.toMatch(/p_texto/);
  });

  it('os três tipos continuam sendo os do glossário', () => {
    // O `check` da tabela mora na migration 123; aqui só confirmo que o
    // vocabulário não andou sozinho.
    expect([...TIPOS_DE_ANOTACAO]).toEqual(['anotacao', 'feedback', 'objecao']);
  });
});
