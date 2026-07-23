// ============================================================
// betVocab.ts — vocabulário de esporte/liga/mercado das apostas
// ============================================================
// Os campos sport/league/betting_market são texto livre no banco. Pra o usuário
// poder criar valores próprios SEM fragmentar o dashboard dele, a lista de cada
// combobox é: base curada ∪ os valores que ELE já usou (por usuário — o custom
// de um não aparece pro outro). E ao salvar, "encaixamos" no canônico existente
// (mesmo valor com caixa/espaço diferente vira o mesmo balde). Isso evita que
// "Over/Under", "over under" e "Over/under" virem 3 mercados distintos.

// Normaliza pra comparação: minúsculas, sem acento, espaços colapsados.
function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Lista final do dropdown: base curada primeiro (na ordem original), depois os
// valores próprios do usuário que não existem na base — ordenados. Dedupe é
// case/acento-insensível, sempre preferindo a grafia canônica da base.
export function mergeVocab(curated: string[], used: Array<string | null | undefined>): string[] {
  const seen = new Set(curated.map(normKey));
  const extras: string[] = [];
  const extrasSeen = new Set<string>();
  for (const raw of used) {
    const value = (raw ?? "").trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = normKey(value);
    if (seen.has(key) || extrasSeen.has(key)) continue;
    extrasSeen.add(key);
    extras.push(value);
  }
  extras.sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...curated, ...extras];
}

// Ao salvar: limpa o valor e, se já existir um equivalente na lista, encaixa na
// grafia canônica dele; senão mantém o que o usuário digitou (trim). É o que
// impede a fragmentação por caixa/acento/espaço.
export function canonicalizeVocab(value: string, options: string[]): string {
  const clean = (value ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const key = normKey(clean);
  const match = options.find((o) => normKey(o) === key);
  return match ?? clean;
}

// Existe um valor equivalente (case/acento-insensível) na lista?
export function vocabHasValue(value: string, options: string[]): boolean {
  const key = normKey(value.trim());
  if (!key) return false;
  return options.some((o) => normKey(o) === key);
}
