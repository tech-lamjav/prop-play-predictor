# Guia de Paginação Client-Side

Este documento descreve o padrão de paginação client-side utilizado no projeto, implementado em [`src/pages/Bets.tsx`](../src/pages/Bets.tsx). Use-o como referência para adicionar paginação em outras páginas com listas ou tabelas.

## Visão geral

- **Tipo**: Paginação client-side (dados carregados de uma vez, fatia no cliente)
- **Pipeline**: `dados brutos` → `filtrados` → `ordenados` → `paginados`
- **UI**: Seletor de linhas por página + navegador com chevrons (anterior/próximo)

## Quando usar

- Listas/tabelas com até ~2.000 itens
- Dados já carregados em memória (filtros e ordenação no cliente)
- Implementação rápida e sem mudanças no backend

Para volumes maiores, considere migrar para paginação server-side.

---

## Implementação passo a passo

### 1. Imports necessários

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
```

### 2. Estado de paginação

```tsx
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(15);
```

**Opções de page size sugeridas**: `15`, `25`, `50`, `100`.

### 3. Pipeline de dados

A paginação deve ser aplicada **depois** de filtros e ordenação:

```tsx
// Exemplo: filteredItems → sortedItems → paginatedItems
const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

const paginatedItems = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return sortedItems.slice(start, start + pageSize);
}, [sortedItems, currentPage, pageSize]);
```

### 4. Reset ao mudar filtros/ordenação

Sempre que filtros, ordenação ou `pageSize` mudarem, volte para a página 1:

```tsx
useEffect(() => {
  setCurrentPage(1);
}, [filters, sortConfig, pageSize]);
```

### 5. Handler de mudança de página

```tsx
const handlePageChange = useCallback((page: number) => {
  setCurrentPage(Math.max(1, Math.min(page, totalPages)));
}, [totalPages]);
```

> **Nota**: Não usamos `window.scrollTo` para manter a posição do usuário ao trocar de página. Se preferir rolar para o topo da lista, adicione `window.scrollTo({ top: 400, behavior: 'smooth' });` dentro do handler.

### 6. Renderizar com dados paginados

Use `paginatedItems` (e não `sortedItems` ou `filteredItems`) para renderizar linhas/cards:

```tsx
{paginatedItems.map((item) => (
  <ItemRow key={item.id} item={item} />
))}
```

### 7. Estatísticas e totais

Mantenha cálculos de estatísticas (totais, médias, etc.) baseados em **todos os itens filtrados**, não nos paginados:

```tsx
// Correto: usa filteredItems ou sortedItems
calculateStats(filteredItems);

// Incorreto: usaria apenas a página atual
calculateStats(paginatedItems); // evite
```

### 8. UI do rodapé de paginação

Coloque o rodapé abaixo da lista/tabela, dentro do bloco que renderiza quando há dados:

```tsx
{/* Rodapé de paginação */}
<div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-terminal-border-subtle">
  {/* Esquerda: seletor de page size + total */}
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-terminal-text opacity-70">Mostrando</span>
    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
      <SelectTrigger className="w-[70px] h-8 text-xs terminal-button border-terminal-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-terminal-dark-gray border-terminal-border">
        <SelectItem value="15">15</SelectItem>
        <SelectItem value="25">25</SelectItem>
        <SelectItem value="50">50</SelectItem>
        <SelectItem value="100">100</SelectItem>
      </SelectContent>
    </Select>
    <span className="text-[10px] text-terminal-text opacity-70">
      de {sortedItems.length} {nomePlural}
    </span>
  </div>

  {/* Direita: navegação */}
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => handlePageChange(currentPage - 1)}
      disabled={currentPage === 1}
      className="terminal-button h-8 w-8 p-0"
    >
      <ChevronLeft className="w-4 h-4" />
    </Button>
    <span className="text-[10px] text-terminal-text opacity-70 min-w-[4rem] text-center">
      {currentPage} de {totalPages}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => handlePageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="terminal-button h-8 w-8 p-0"
    >
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
</div>
```

Substitua `nomePlural` pelo texto adequado (ex.: `"apostas"`, `"documentos"`, `"itens"`).

---

## Checklist de implementação

- [ ] Estado `currentPage` e `pageSize`
- [ ] `totalPages` e `paginatedItems` via `useMemo`
- [ ] `useEffect` para resetar `currentPage` em mudanças de filtros/sort/pageSize
- [ ] `handlePageChange` com clamp de limites
- [ ] Renderização usando `paginatedItems`
- [ ] Estatísticas usando dados completos (não paginados)
- [ ] Rodapé com seletor de page size e chevrons
- [ ] Tratamento de lista vazia (não mostrar rodapé ou mostrar mensagem adequada)

---

## Referência: Bets.tsx

| Trecho | Localização aproximada |
|--------|------------------------|
| Estado de paginação | ~linha 631 |
| Cálculo `totalPages` e `paginatedBets` | ~linhas 1337–1341 |
| Reset de página | ~linhas 1445–1447 |
| `handlePageChange` | ~linhas 1576–1578 |
| Rodapé de paginação | ~linhas 1989–2030 |

---

## Evolução futura: server-side

Quando o volume justificar (~2.000+ itens ou degradação de performance), migre para paginação server-side:

- Buscar apenas a página atual no backend (ex.: Supabase com `range`)
- Filtros e ordenação via query
- Manter a mesma UI de rodapé, trocando a fonte de dados
