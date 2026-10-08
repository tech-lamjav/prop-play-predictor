import { PAIS_PADRAO, paisPorCodigo } from '@/config/paises';

/**
 * De que país é quem está preenchendo o cadastro, pelo fuso do navegador.
 *
 * É um CHUTE INICIAL de campo de formulário, não uma afirmação sobre a pessoa:
 * ela vê o país preenchido e troca com um clique se estiver errado. Essa é a
 * régua que justifica um palpite — errar custa um clique, e acertar poupa um
 * clique de todo mundo que não é do Brasil.
 *
 * ⚠️ POR QUE NÃO USA A LÓGICA DE IP QUE JÁ EXISTE EM PRODUÇÃO. Existe
 * `paisDoIp` em `supabase/functions/shared/pais-do-ip.ts`, e ela não serve
 * aqui, por três razões que estão escritas na própria função:
 *
 *   1. ela é um trabalho em LOTE, chamado pelo `resolver-pais` via pg_cron com
 *      `x-cron-secret`, que lê linhas pendentes do registro de presença. Não é
 *      um endpoint que o navegador possa perguntar "de que país eu sou";
 *   2. a tabela de faixas tem 573 kB. Mandar isso para o navegador por causa
 *      de um campo de formulário contraria o requisito de não piorar o
 *      carregamento;
 *   3. a fonte é do LACNIC, que delega para a América Latina e o Caribe: um
 *      endereço da Europa, dos EUA ou da Ásia volta `null`.
 *
 * O comentário dela diz, duas vezes, que essa pergunta DE PROPÓSITO não
 * acontece no caminho de quem está navegando. O fuso do navegador responde a
 * mesma pergunta de graça, na hora, sem pedido de rede e no mundo inteiro.
 *
 * Expor `paisDoIp` numa função pública continua possível, e seria mais preciso
 * na América Latina — mas é endpoint novo, entrada na lista de deploy e uma
 * decisão de privacidade. Não é o que um valor inicial de campo pede.
 *
 * ⚠️ ISTO NÃO É ORIGEM OBSERVADA NEM ORIGEM DECLARADA. O glossário da pessoa
 * (`src/components/perfil/CONTEXT.md`) separa as duas de propósito: observada é
 * o país que o IP disse ao NOSSO SERVIDOR, e serve de prova; declarada é o país
 * que a pessoa informou no endereço de cobrança, e vem do Stripe, o que a torna
 * evidência de terceiro. As duas discordam com frequência e com razão, e é por
 * isso que ficam guardadas separadas.
 *
 * O que esta função devolve é um PALPITE, e não entra nessa conversa: ninguém
 * prova nada com ele, e a pessoa troca com um clique. Ele tem dois usos, os
 * dois de valor inicial: o campo de país do cadastro, e a moeda de quem criou
 * conta antes de esse campo existir (`utils/moeda-ativa.ts`). Nos dois, a
 * escolha explícita da pessoa vence o palpite. Também
 * não é segundo juiz de nada — quem decide acesso é o porteiro, uma vez por
 * sessão e do lado do servidor, e a tela só obedece.
 */

/**
 * Fuso IANA para código ISO do país.
 *
 * Só os 27 países que o seletor oferece: fuso de fora cai no padrão, e isso é
 * correto — chutar um país que a lista não tem deixaria o campo num estado que
 * a pessoa não consegue reproduzir.
 *
 * Os cinco países da operação estão com TODOS os fusos; os outros, com os
 * principais. É onde o acerto importa.
 */
const POR_FUSO: Record<string, string> = {
  // Brasil
  'America/Sao_Paulo': 'BR',
  'America/Bahia': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Maceio': 'BR',
  'America/Araguaina': 'BR',
  'America/Belem': 'BR',
  'America/Santarem': 'BR',
  'America/Manaus': 'BR',
  'America/Boa_Vista': 'BR',
  'America/Porto_Velho': 'BR',
  'America/Cuiaba': 'BR',
  'America/Campo_Grande': 'BR',
  'America/Rio_Branco': 'BR',
  'America/Eirunepe': 'BR',
  'America/Noronha': 'BR',
  // Peru
  'America/Lima': 'PE',
  // México
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/Monterrey': 'MX',
  'America/Matamoros': 'MX',
  'America/Chihuahua': 'MX',
  'America/Ciudad_Juarez': 'MX',
  'America/Ojinaga': 'MX',
  'America/Mazatlan': 'MX',
  'America/Bahia_Banderas': 'MX',
  'America/Hermosillo': 'MX',
  'America/Tijuana': 'MX',
  // Chile
  'America/Santiago': 'CL',
  'America/Punta_Arenas': 'CL',
  'Pacific/Easter': 'CL',
  // Resto da América Latina
  'America/Bogota': 'CO',
  'America/Montevideo': 'UY',
  'America/Asuncion': 'PY',
  'America/La_Paz': 'BO',
  'America/Guayaquil': 'EC',
  'Pacific/Galapagos': 'EC',
  'America/Caracas': 'VE',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Guatemala': 'GT',
  'America/Santo_Domingo': 'DO',
  // Fora da América Latina
  'Europe/Lisbon': 'PT',
  'Atlantic/Azores': 'PT',
  'Atlantic/Madeira': 'PT',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Africa/Ceuta': 'ES',
  'Europe/Rome': 'IT',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Africa/Luanda': 'AO',
  'Africa/Maputo': 'MZ',
  'Asia/Tokyo': 'JP',
  'America/New_York': 'US',
  'America/Detroit': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'America/Winnipeg': 'CA',
  'America/Regina': 'CA',
  'America/Edmonton': 'CA',
  'America/Vancouver': 'CA',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Darwin': 'AU',
};

/**
 * Prefixos que resolvem um país inteiro.
 *
 * A Argentina tem doze fusos, todos sob `America/Argentina/`, e nenhum deles se
 * chama "Argentina" — são `Buenos_Aires`, `Cordoba`, `Mendoza`, `Ushuaia` e
 * mais oito. Listar os doze é mais frágil que ler o prefixo, porque a base de
 * fusos acrescenta e aposenta cidade.
 */
const POR_PREFIXO: Array<[string, string]> = [
  ['America/Argentina/', 'AR'],
  ['America/Indiana/', 'US'],
  ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'],
];

/** O fuso que o navegador diz, ou vazio onde a API não existir. */
function fusoDoNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // `Intl` sem fuso resolvido acontece em ambiente de teste e em navegador
    // antigo. Sem fuso o cadastro simplesmente abre no padrão, como antes.
    return '';
  }
}

/**
 * O país do fuso, ou `PAIS_PADRAO`.
 *
 * Nunca devolve código que não esteja no seletor: um palpite fora da lista
 * deixaria o campo mostrando algo que a pessoa não consegue selecionar de novo
 * se trocar por engano.
 */
export function paisDoFuso(fuso = fusoDoNavegador()): string {
  const porPrefixo = POR_PREFIXO.find(([p]) => fuso.startsWith(p));
  const palpite = porPrefixo ? porPrefixo[1] : POR_FUSO[fuso];
  return palpite && paisPorCodigo(palpite) ? palpite : PAIS_PADRAO;
}
