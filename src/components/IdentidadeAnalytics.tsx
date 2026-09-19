import { useIdentidadeAnalytics } from '@/hooks/use-identidade-analytics';

/**
 * Casca de montagem do `useIdentidadeAnalytics`.
 *
 * O gancho precisa rodar uma vez por aplicação, e o `App` é uma função de
 * componente que só devolve JSX — não há onde chamar um hook lá dentro sem
 * transformar o `App` inteiro. Um componente-sentinela que não desenha nada é
 * o mesmo padrão que o `PostHogPageView` já usa.
 */
export const IdentidadeAnalytics = () => {
  useIdentidadeAnalytics();
  return null;
};
