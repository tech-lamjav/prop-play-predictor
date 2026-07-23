import { Seo } from "@/components/Seo";

/**
 * Página pública (sem auth) com os Termos de Uso e a Política de Privacidade
 * da SMARTBETTING. Conteúdo transcrito do documento jurídico oficial
 * (LAMJAV TECNOLOGIA E INOVAÇÃO LTDA). Renderizada no tema "Direção A" (light)
 * pra ficar consistente com as landings públicas.
 *
 * IMPORTANTE: o documento original veio com o e-mail de contato de privacidade
 * em branco. Constante abaixo precisa ser confirmada antes de ir pra produção.
 */
const CONTATO_LGPD = "contato@smartbetting.app"; // TODO: confirmar e-mail de privacidade/LGPD (doc veio em branco)

const ULTIMA_ATUALIZACAO = "23 de março de 2026";

type Block = { sub?: string; label?: string; p?: string };
type Section = { divider?: string; n?: string; title?: string; blocks: Block[] };

const SECTIONS: Section[] = [
  {
    n: "1",
    title: "Informações Importantes acerca da SMARTBETTING",
    blocks: [
      { p: "A SMARTBETTING é uma plataforma digital de análise de dados esportivos cuja missão é tornar as apostas esportivas mais inteligentes e acessíveis, transformando dados complexos em informações claras e acionáveis." },
      { p: "Tudo que a SMARTBETTING oferece é construído sobre dados reais e históricos, com total transparência. A plataforma não faz promessas de ganho garantido e não indica apostas específicas — seu papel é fornecer análises objetivas para que o próprio usuário tome decisões mais informadas." },
      { p: "Os serviços estão disponíveis em português (PT-BR) e inglês (EN), e são destinados exclusivamente a maiores de 18 anos. O acesso se dá pelo site smartbetting.app." },
      { p: "A SMARTBETTING é uma plataforma de análise estatística e suporte informacional, não constituindo, em hipótese alguma, casa de apostas, operadora de jogos ou qualquer modalidade de agente intermediário em transações de apostas esportivas. Todos os dados, análises, projeções e recomendações disponibilizados pela plataforma — incluindo aqueles gerados pelo assistente Betinho — têm caráter exclusivamente informativo e educacional, destinando-se a subsidiar a tomada de decisão autônoma do Usuário. A SMARTBETTING não realiza apostas em nome do Usuário, não gerencia recursos financeiros de terceiros, não garante resultados e não possui qualquer vínculo com as plataformas de apostas eventualmente utilizadas pelo Usuário. A responsabilidade pela decisão de apostar, pela escolha da plataforma de apostas, pelo gerenciamento do capital investido e pelas consequências financeiras decorrentes é integralmente do Usuário, que declara ciência de que o uso das informações fornecidas pela SMARTBETTING não elimina os riscos inerentes à atividade de apostas esportivas. O contrato firmado entre as partes tem por objeto exclusivo o acesso a dados e ferramentas analíticas, não configurando qualquer forma de assessoria financeira, de investimento ou de gestão de ativos." },
    ],
  },
  {
    n: "2",
    title: "Produtos Disponíveis",
    blocks: [
      { p: "A SMARTBETTING oferece dois produtos integrados entre si, ambos com acesso gratuito disponível, e acessos premiums devidamente contratados." },
      { sub: "2.1 Plataforma de Análises — smartbetting.app" },
      { p: "A Plataforma de Análises é um dashboard web com foco atual em prop bets da NBA. Utilizando um modelo proprietário treinado com milhares de resultados históricos, a plataforma entrega análises prontas de forma rápida e objetiva, sem que o usuário precise coletar dados manualmente." },
      { p: "Entre as funcionalidades disponibilizadas estão a taxa de acerto (hit rate) por jogador e por linha de aposta nos últimos 15 jogos, gráficos de performance comparados à linha, shooting zones com dados de FGA, FGM e FG% por região da quadra, e análise automática das odds das principais casas de apostas com integração ao Injury Report oficial. Todo o histórico do modelo é exibido de forma transparente e auditável pelo próprio usuário." },
      { p: "O usuário pode experimentar o dashboard com dados reais sem necessidade de cadastro, por meio do acesso gratuito disponível no site." },
      { sub: "2.2 Betinho — Assistente de Apostas por IA — smartbetting.app/betinho" },
      { p: "O Betinho é um assistente inteligente acessível via WhatsApp e Telegram que usa inteligência artificial para registrar e organizar as apostas do usuário de forma automática. O fluxo é simples: o usuário envia uma mensagem de texto ou um print da aposta pelo aplicativo de mensagens de sua preferência, e o Betinho processa as informações e sincroniza tudo no dashboard." },
      { p: "O bot possui reconhecimento ótico de caracteres (OCR) para extrair odds, valor apostado e jogo diretamente de prints. Também entende mensagens de texto com múltiplas linhas, odds e stakes, calcula odds combinadas automaticamente e permite registrar o resultado da aposta — ganhou, perdeu ou cashout — pelo próprio chat." },
      { p: "Todas as apostas registradas aparecem no dashboard com métricas completas: taxa de acerto, ROI, lucro total e evolução da banca. O Betinho suporta apostas de NBA, futebol (Brasileirão, Serie A e outros) e demais esportes. Não requer instalação adicional e o acesso básico é gratuito." },
    ],
  },
  {
    n: "3",
    title: "Planos e Preços",
    blocks: [
      { p: "A SMARTBETTING adota um modelo de negócio Freemium, no qual o acesso básico é gratuito e o Plano Premium desbloqueia todas as funcionalidades." },
      { sub: "3.1 Plano Gratuito" },
      { p: "O plano gratuito inclui acesso à análise de dois jogadores da NBA: Nikola Jokic e Victor Wembanyama. Além disso, o usuário tem acesso ao dashboard básico de gestão de apostas, ao Betinho (via WhatsApp e Telegram) e ao controle de bankroll. Não há qualquer custo ou obrigação para utilizar este plano." },
      { sub: "3.2 Plano Premium — R$ 99,90 por mês" },
      { p: "O Plano Premium concede acesso completo à plataforma, incluindo análise de todos os jogadores da NBA, análises avançadas com scores de confiança, Injury Insights completos sobre o impacto de lesões nos props de titulares e reservas, betting dashboard com métricas detalhadas de ROI, win rate e lucro por esporte e mercado, shooting zones, comparativos e suporte prioritário. O pagamento é processado via Stripe." },
      { p: "O valor mensal de R$ 99,90 pode variar conforme o país do usuário em razão de diferenças cambiais. A assinatura é renovada automaticamente a cada período. Para cancelar, basta acessar as configurações da conta e desativar a renovação com pelo menos 24 horas de antecedência do vencimento. Após o cancelamento, o acesso permanece ativo até o fim do período já pago. Eventuais reembolsos são de responsabilidade da plataforma de pagamento (Stripe), que atua como intermediária entre o consumidor e a SMARTBETTING." },
    ],
  },
  {
    n: "4",
    title: "Disponibilidade dos Serviços",
    blocks: [
      { p: "Os serviços podem ser adquiridos e utilizados no Brasil a qualquer momento enquanto estiverem disponíveis na plataforma. As análises da Plataforma de Análises estão vinculadas ao calendário oficial das ligas cobertas — atualmente com foco na NBA — e ficam ativas durante o período de realização dos campeonatos. O Betinho, por sua vez, funciona de forma contínua, independente do calendário esportivo." },
      { p: "A lista de jogadores, campeonatos, clubes e ligas disponíveis na plataforma pode ser alterada a qualquer momento, a critério da SMARTBETTING ou por decisão das entidades organizadoras, sem necessidade de aviso prévio. Em períodos de alto volume de acessos simultâneos, podem ocorrer pequenos atrasos na atualização de dados e métricas." },
    ],
  },
  {
    divider: "Política de Privacidade",
    n: "5",
    title: "Identificação do Controlador",
    blocks: [
      { p: "A SMARTBETTING é operada por LAMJAV TECNOLOGIA E INOVAÇÃO LTDA, inscrita no CNPJ sob o nº 62.004.595/0001-00, com sede na cidade de Londrina – PR. Nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD), a SMARTBETTING é considerada Controladora dos dados pessoais de seus usuários, sendo responsável pelas decisões sobre o tratamento dessas informações." },
      { p: `Os usuários são considerados titulares dos dados e consumidores da plataforma. Dúvidas, solicitações e requerimentos relacionados a dados pessoais podem ser direcionados pelo e-mail ${CONTATO_LGPD}.` },
    ],
  },
  {
    n: "6",
    title: "Objetivo desta Política",
    blocks: [
      { p: "Esta Política de Privacidade tem como objetivo esclarecer, de forma clara e transparente, como a SMARTBETTING coleta, utiliza, armazena, compartilha e trata os dados pessoais de seus usuários. Ela foi elaborada em conformidade com a LGPD e se aplica a todo tratamento de dados pessoais realizado no Brasil." },
      { p: "Ao aceitar esta Política — por meio do clique em “Aceito” no momento do cadastro ou assinatura —, o usuário autoriza expressamente o tratamento de seus dados pessoais para as finalidades aqui descritas." },
    ],
  },
  {
    n: "7",
    title: "Dados Coletados",
    blocks: [
      { p: "Para que a SMARTBETTING possa prestar seus serviços de forma adequada, são coletados e tratados os seguintes dados pessoais, sempre com base em autorização do titular ou em outra base legal prevista na LGPD." },
      { label: "Dados fornecidos pelo usuário:", p: "nome completo, e-mail, telefone (incluindo WhatsApp)." },
      { label: "Dados coletados automaticamente:", p: "endereço IP, dados de navegação e uso da plataforma, informações técnicas do dispositivo (URL, conexão, provedor, sistema operacional, modelo), cookies e, caso autorizado pelo usuário, dados de geolocalização." },
      { label: "Dados de terceiros:", p: "informações provenientes do Sistema de Informações de Crédito (SCR) quando necessário, dados de perfil de redes sociais quando o usuário realiza login por essa via, e dados compartilhados por parceiros de publicidade." },
      { label: "Dados produzidos pelo uso da plataforma:", p: "histórico de atendimento, dados de contratação de produtos e serviços, interações com a SMARTBETTING em redes sociais, dados agrupados e anonimizados para fins estatísticos, e preferências de uso." },
    ],
  },
  {
    n: "8",
    title: "Links e Conteúdo de Terceiros",
    blocks: [
      { p: "A plataforma pode conter links para sites, aplicativos, plug-ins e anúncios de terceiros. Ao acessar esses conteúdos, o usuário pode permitir que terceiros coletem ou compartilhem seus dados. A SMARTBETTING não controla esses serviços externos e não se responsabiliza por suas práticas de privacidade. Recomendamos a leitura das políticas de privacidade de cada serviço externo visitado." },
    ],
  },
  {
    n: "9",
    title: "Como Usamos seus Dados",
    blocks: [
      { p: "Os dados pessoais dos usuários são utilizados exclusivamente quando a lei autoriza e para as seguintes finalidades: execução do contrato de assinatura celebrado; gerenciamento do relacionamento com o usuário e comunicação sobre alterações nos serviços, funcionalidades ou preços; envio de conteúdo de marketing e promoções, desde que o usuário tenha dado consentimento; prestação de suporte ao cliente; e cumprimento de obrigações legais e regulatórias." },
    ],
  },
  {
    n: "10",
    title: "Compartilhamento de Dados",
    blocks: [
      { p: "Os dados dos usuários podem ser compartilhados com empresas do grupo SMARTBETTING e com terceiros parceiros que prestam serviços necessários à operação da plataforma, mediante autorização do usuário. Também podem ser compartilhados com autoridades e órgãos reguladores quando exigido por lei. Todo compartilhamento observa os limites e propósitos estabelecidos pela LGPD." },
      { p: "Alguns dados poderão ser transferidos para servidores localizados fora do Brasil, como em casos de armazenamento em nuvem. Nessas situações, são adotadas as medidas de segurança exigidas pela legislação vigente." },
    ],
  },
  {
    n: "11",
    title: "Retenção e Exclusão dos Dados",
    blocks: [
      { p: "Enquanto o usuário estiver ativo na plataforma, seus dados são mantidos em ambiente seguro e controlado. Mesmo após o cancelamento da conta ou da assinatura, a SMARTBETTING poderá reter dados pelo tempo necessário para cumprir obrigações legais ou regulatórias, atender exigências da Receita Federal do Brasil e preservar direitos em eventuais processos judiciais ou administrativos." },
    ],
  },
  {
    n: "12",
    title: "Medidas de Segurança",
    blocks: [
      { p: "A SMARTBETTING adota padrões de segurança reconhecidos pela indústria e pode utilizar tecnologias como cloud computing e blockchain para armazenar e proteger os dados dos usuários. Recomendamos que os usuários nunca compartilhem sua senha de acesso, evitem acessar a plataforma em redes Wi-Fi públicas ou desconhecidas e zelem pela segurança de suas credenciais. Login e senha são pessoais e intransferíveis." },
    ],
  },
  {
    n: "13",
    title: "Seus Direitos como Titular de Dados",
    blocks: [
      { p: "A LGPD garante ao usuário um conjunto de direitos que podem ser exercidos a qualquer momento mediante solicitação à SMARTBETTING. São eles: confirmar se seus dados estão sendo tratados; acessar os dados que mantemos sobre você; corrigir dados incompletos, inexatos ou desatualizados; solicitar a anonimização, bloqueio ou exclusão de dados desnecessários ou tratados em desconformidade com a lei; solicitar a portabilidade dos dados a outro prestador de serviços, quando regulamentado pela Autoridade Nacional de Proteção de Dados (ANPD); saber com quais empresas seus dados foram compartilhados; revogar o consentimento para o tratamento de dados específicos; e peticionar perante a ANPD." },
      { p: `A revogação do consentimento pode resultar na impossibilidade de uso parcial ou total de algumas funcionalidades da plataforma. Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail ${CONTATO_LGPD}. Por medida de segurança, poderemos solicitar comprovante de identidade.` },
    ],
  },
  {
    n: "14",
    title: "Consentimento",
    blocks: [
      { p: "Alguns dados pessoais somente serão coletados com o consentimento expresso do usuário. No momento do cadastro ou assinatura, os documentos necessários e esta Política de Privacidade serão apresentados para leitura antes da conclusão do processo. O tratamento de dados é condição necessária para que a SMARTBETTING possa prestar seus serviços com qualidade." },
    ],
  },
  {
    n: "15",
    title: "Alterações desta Política",
    blocks: [
      { p: "A SMARTBETTING pode atualizar esta Política a qualquer momento. Alterações serão comunicadas por notificação no aplicativo ou outros canais cadastrados pelo usuário. As novas condições entram em vigor assim que publicadas na plataforma. A continuidade do uso dos serviços após a atualização implica aceite tácito. O usuário pode manifestar discordância a qualquer momento pelos canais de atendimento." },
    ],
  },
  {
    divider: "Termos de Uso",
    blocks: [
      { p: "Este Termo de Uso rege as condições de utilização da plataforma SMARTBETTING, também denominada BETINHO, operada por LAMJAV TECNOLOGIA E INOVAÇÃO LTDA, CNPJ 62.004.595/0001-00, com sede cidade de Londrina – PR. Ao utilizar qualquer serviço da plataforma, o usuário — doravante denominado Você — concorda integralmente com as regras a seguir." },
    ],
  },
  {
    n: "16",
    title: "Requisitos para Uso",
    blocks: [
      { p: "Para contratar e utilizar os serviços da SMARTBETTING, você precisa ter 18 anos ou mais (ou estar devidamente representado conforme a lei), realizar o cadastro completo com login e senha pessoais e intransferíveis, preencher corretamente os campos obrigatórios — nome completo, e-mail e telefone —, ter acesso à internet e arcar com seus custos, e manter uma forma de pagamento válida e a assinatura em dia." },
      { p: "Você é inteiramente responsável pelo sigilo e pela segurança da sua conta. Não compartilhe seus dados de acesso com terceiros e não utilize contas alheias. Em caso de suspeita de acesso não autorizado, entre em contato imediatamente com a SMARTBETTING. Ao contratar via terceiros autorizados, você consente que esses terceiros compartilhem suas informações de cadastro com a SMARTBETTING." },
    ],
  },
  {
    n: "17",
    title: "Aceitação e Vigência",
    blocks: [
      { p: "Ao utilizar os serviços, você confirma que leu e concorda com esta Política de Privacidade, com este Termo de Uso e com o contrato da assinatura escolhida. A utilização dos serviços após qualquer alteração deste Termo será considerada como aceite das novas condições." },
    ],
  },
  {
    n: "18",
    title: "Funcionamento dos Serviços",
    blocks: [
      { p: "Os serviços da SMARTBETTING contemplam análises esportivas, sintetização de notícias e dados sobre times, jogadores, técnicos e campeonatos. As métricas e parametrizações disponíveis variam conforme o plano contratado e as características de cada campeonato ou jogo. Em períodos de alto volume de acessos simultâneos, podem ocorrer pequenos atrasos na atualização das informações, o que não configura falha de serviço." },
      { p: "Caso você tenha se cadastrado por meio de redes sociais, autoriza a importação da sua foto de perfil para identificá-lo na plataforma. A SMARTBETTING reserva-se o direito de remover imagens consideradas impróprias conforme suas políticas." },
    ],
  },
  {
    n: "19",
    title: "Usos Proibidos",
    blocks: [
      { p: "Para garantir um ambiente seguro e íntegro para todos os usuários, é expressamente vedado utilizar a plataforma para fins ilegais, fraudulentos ou contrários à moral; compartilhar conteúdo pornográfico, discriminatório, ofensivo ou ilegal; realizar scraping, mineração de dados ou extração automatizada; aplicar engenharia reversa a qualquer software da plataforma; transmitir vírus ou códigos maliciosos; alterar endereços IP ou geolocalização para enganar terceiros; copiar ou redistribuir conteúdo sem autorização; e sobrecarregar ou comprometer os servidores da SMARTBETTING." },
    ],
  },
  {
    n: "20",
    title: "Propriedade Intelectual e Licença",
    blocks: [
      { p: "Todo o conteúdo da plataforma — textos, análises, imagens, gráficos, softwares, marcas e logotipos — é propriedade da SMARTBETTING ou está licenciado a ela, protegido pela legislação de direitos autorais e propriedade intelectual." },
      { p: "A SMARTBETTING concede ao usuário uma licença de uso pessoal, não exclusiva, intransferível e limitada, apenas para uso privado e não comercial. Essa licença não transfere qualquer propriedade ou titularidade sobre a plataforma." },
      { p: "Ao utilizar os serviços, o usuário cede à SMARTBETTING, de forma gratuita e universal, os direitos patrimoniais sobre o material por ele criado a partir da plataforma, incluindo a possibilidade de uso em promoção, distribuição, transmissão e comercialização em qualquer mídia. Violações a esses direitos poderão resultar em bloqueio imediato do acesso e nas medidas legais cabíveis." },
    ],
  },
  {
    n: "21",
    title: "Limitação de Responsabilidade",
    blocks: [
      { p: "Os serviços são disponibilizados no estado em que se encontram. A SMARTBETTING não garante que a plataforma estará sempre livre de erros, interrupções ou imprecisões. Não nos responsabilizamos por interrupções causadas por manutenção, falhas de operadoras de telecomunicações, ataques de terceiros ou casos de força maior, tampouco pela qualidade da conexão à internet do usuário, por conteúdo de terceiros anunciado na plataforma, nem por eventuais perdas financeiras decorrentes de apostas realizadas com base nas informações disponibilizadas." },
    ],
  },
  {
    n: "22",
    title: "Indenização",
    blocks: [
      { p: "O usuário concorda em indenizar a SMARTBETTING por quaisquer prejuízos, custos e honorários advocatícios decorrentes de violações a este Termo, à Política de Privacidade ou ao contrato de assinatura, sejam essas violações cometidas pelo próprio usuário ou por qualquer pessoa utilizando sua conta." },
    ],
  },
  {
    n: "23",
    title: "Notificações",
    blocks: [
      { p: "A SMARTBETTING se comunicará com o usuário pelo e-mail cadastrado ou pelos canais online da plataforma. Alterações que impliquem ônus financeiro serão comunicadas com 30 dias de antecedência; as demais, com 7 dias." },
    ],
  },
  {
    n: "24",
    title: "Alterações nos Serviços e neste Termo",
    blocks: [
      { p: "A SMARTBETTING pode, a qualquer momento, modificar características, funcionalidades, atletas e campeonatos disponíveis na plataforma, sem aviso prévio. Este Termo também pode ser alterado periodicamente, sempre com comunicação ao usuário. Caso o usuário discorde de qualquer alteração, poderá cancelar a assinatura. A SMARTBETTING pode ainda ceder ou transferir este Termo a terceiros, inclusive em operações de fusão ou venda de ativos, sem notificação prévia." },
    ],
  },
  {
    n: "25",
    title: "Disposições Gerais",
    blocks: [
      { p: "A SMARTBETTING não aceita materiais ou ideias enviados sem solicitação prévia e não se responsabiliza por eventuais semelhanças com eles. Se qualquer cláusula deste Termo for considerada inválida, o restante permanece em pleno vigor. Deixar de aplicar uma cláusula em um caso específico não representa renúncia ao direito correspondente. Ao aceitar este Termo, o usuário autoriza o recebimento de mensagens de marketing da SMARTBETTING e de seus parceiros." },
      { p: "Este Termo é regido pela legislação brasileira." },
    ],
  },
];

const Privacidade = () => {
  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink">
      <Seo
        path="/privacidade"
        title="Termos de Uso e Política de Privacidade — Smart Betting"
        description="Termos de Uso e Política de Privacidade da SMARTBETTING (LAMJAV Tecnologia e Inovação LTDA), em conformidade com a LGPD."
      />

      <main className="container mx-auto px-4 sm:px-6 py-12 max-w-3xl">
        <a
          href="/"
          className="text-sm text-forest hover:text-forest-2 transition-colors"
        >
          ← Voltar ao início
        </a>

        <header className="mt-6 border-b border-line pb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Termos de Uso e Política de Privacidade
          </h1>
          <p className="mt-3 text-ink-2">
            LAMJAV TECNOLOGIA E INOVAÇÃO LTDA · CNPJ 62.004.595/0001-00
          </p>
          <p className="mt-1 text-sm text-ink-3">
            Última atualização: {ULTIMA_ATUALIZACAO}
          </p>

          <div className="mt-6 rounded-rebrand-md border border-amber bg-amber/10 px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              Leia com atenção antes de usar a plataforma
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Ao acessar ou utilizar qualquer recurso da plataforma smartbetting.app, você
              confirma que leu, entendeu e concorda integralmente com todos os termos e
              condições descritos neste documento. Caso não concorde, por favor não utilize
              a plataforma.
            </p>
          </div>
        </header>

        <article className="mt-8">
          {SECTIONS.map((section, i) => (
            <section key={i}>
              {section.divider && (
                <h2 className="mt-12 mb-2 text-2xl font-bold tracking-tight text-forest border-b border-line pb-2">
                  {section.divider}
                </h2>
              )}
              {section.n && (
                <h3 className="mt-8 text-lg font-semibold text-ink">
                  {section.n}. {section.title}
                </h3>
              )}
              {section.blocks.map((b, j) =>
                b.sub ? (
                  <h4 key={j} className="mt-5 font-semibold text-ink">
                    {b.sub}
                  </h4>
                ) : (
                  <p key={j} className="mt-3 text-ink-2 leading-relaxed">
                    {b.label && <strong className="text-ink">{b.label} </strong>}
                    {b.p}
                  </p>
                )
              )}
            </section>
          ))}

          <p className="mt-12 border-t border-line pt-6 text-sm text-ink-3">
            Documento elaborado em conformidade com a Lei nº 13.709/2018 (LGPD). Última
            atualização: {ULTIMA_ATUALIZACAO}.
          </p>
        </article>
      </main>
    </div>
  );
};

export default Privacidade;
