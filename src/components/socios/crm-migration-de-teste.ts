import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Ler uma migration para guardá-la em teste.
 *
 * Existe porque três suítes faziam a mesma coisa copiada: ler o arquivo, trocar
 * as quebras de linha e tirar os comentários. A terceira cópia já tinha
 * esquecido do último passo.
 *
 * Os comentários saem de propósito. As migrations do CRM escrevem a versão
 * ERRADA do código dentro do comentário para explicar por que ela não pode ser
 * usada — a política que recursa, por exemplo. Um guarda que lê o arquivo
 * inteiro acusa esse exemplo e fica vermelho com a migration certa.
 */
export function lerMigration(nome: string): string {
  return readFileSync(resolve(__dirname, '../../../supabase/migrations', nome), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/--.*$/gm, '');
}

/**
 * Um comando isolado dentro da migration, do começo até o `;` que o fecha.
 *
 * Ler o arquivo inteiro é o erro que já passou aqui: `toMatch(/security
 * definer/)` sobre a migration toda fica verde se QUALQUER outra função tiver a
 * palavra, mesmo com a função guardada já sem ela. A asserção precisa cair
 * dentro da declaração que ela diz guardar.
 *
 * Corpo de função termina em `$function$;`, e não no primeiro `;`: há ponto e
 * vírgula dentro do SQL.
 */
export function comando(sql: string, inicio: RegExp, fim = ';'): string | null {
  const i = sql.search(inicio);
  if (i < 0) return null;
  const f = sql.indexOf(fim, i);
  return f < 0 ? null : sql.slice(i, f + fim.length);
}
