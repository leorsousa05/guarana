import React, { useEffect, useRef, useState } from 'react';

const repository = 'https://github.com/leorsousa05/guarana';
const source = (path) => `${repository}/blob/main/${path}`;

const guides = [
  {
    group: 'Comece aqui',
    pages: [
      { id: 'start', title: 'Visão geral', description: 'O que Guarana faz e por onde começar.', keywords: 'introdução OpenCode ciclo estável requisitos', body: <StartPage /> },
      { id: 'install', title: 'Instalação', description: 'Instale a versão estável v1.5.0 a partir do GitHub.', keywords: 'Node npm link clone v1.5.0 global project', body: <InstallPage /> },
      { id: 'quickstart', title: 'Primeiros passos', description: 'Abra uma sessão OpenCode e experimente o ciclo automático.', keywords: 'pedido natural tarefa guarana list web', body: <QuickStartPage /> },
      { id: 'update', title: 'Atualizar e desinstalar', description: 'Atualize ou remova skills e plugins com segurança.', keywords: 'update uninstall project plugins-only', body: <UpdatePage /> },
    ],
  },
  {
    group: 'Usar Guarana',
    pages: [
      { id: 'workflow', title: 'Fluxo e recuperação', description: 'Acompanhe etapas, falhas de verificação e retomada.', keywords: 'workflow plan build code verify debug remember retry', body: <WorkflowPage /> },
      { id: 'cli', title: 'Referência da CLI', description: 'Famílias de comandos e opções suportadas.', keywords: 'flags install plugin advisor web memory specs workflow help version', body: <CliPage /> },
      { id: 'skills', title: 'Skills disponíveis', description: 'Índice atual, responsabilidades e gatilhos de cada skill.', keywords: 'plan build code verify research remember memory skill-authoring maintenance debug measure specs', body: <SkillsPage /> },
      { id: 'memory', title: 'Memória e privacidade', description: 'Entenda persistência, escopos, busca e injeção automática.', keywords: 'vault graph preferences injection budget autoInject scope privacy', body: <MemoryPage /> },
      { id: 'dashboard', title: 'Dashboard local', description: 'Superfícies, modelos, preferências e configuração local.', keywords: 'Overview Activity Runs Specs Workflow Memory Skills Settings advisor models port', body: <DashboardPage /> },
      { id: 'security', title: 'Segurança e solução de problemas', description: 'Limites de confiança, recuperação segura e diagnósticos comuns.', keywords: 'security plugin adopt symlink manifest loopback troubleshooting', body: <SecurityPage /> },
    ],
  },
  {
    group: 'Desenvolver e contribuir',
    pages: [
      { id: 'architecture', title: 'Arquitetura', description: 'Componentes, persistência e integração com OpenCode.', keywords: 'architecture plugin hooks Task orchestrator memory CLI layout', body: <ArchitecturePage /> },
      { id: 'development', title: 'Desenvolvimento', description: 'Configure o checkout, rode os testes e valide o pacote CLI.', keywords: 'developer setup build npm test check-cli contributing', body: <DevelopmentPage /> },
      { id: 'pages', title: 'Este site e GitHub Pages', description: 'Como o portal é construído e publicado pelo repositório.', keywords: 'Vite React Pages /guarana/ deployment workflow', body: <PagesPage /> },
    ],
  },
];

const allPages = guides.flatMap(({ pages }) => pages);
const examplesPage = {
  id: 'examples',
  title: 'Exemplos práticos',
  description: 'Pedidos naturais e comandos que você pode adaptar ao seu projeto.',
  keywords: 'exemplos prompts request CLI configuração',
  body: <ExamplesPage />,
};

function Code({ children }) {
  return <pre><code>{children}</code></pre>;
}

function SourceLinks({ paths }) {
  return (
    <aside className="docs-source-links" aria-label="Fontes canônicas">
      <strong>Fontes canônicas</strong>
      <ul>{paths.map(([label, path]) => <li key={path}><a href={source(path)} target="_blank" rel="noreferrer">{label}<span aria-hidden="true"> ↗</span></a></li>)}</ul>
    </aside>
  );
}

function StartPage() {
  return <>
    <p className="docs-lead">Guarana é um conjunto de skills e plugins para transformar pedidos de engenharia no OpenCode em trabalho verificável. O estado operacional persiste em arquivos do projeto; cada etapa tem uma condição clara e a verificação é independente.</p>
    <div className="docs-callout"><strong>Versão estável: v1.5.0.</strong> A versão 1.5.4 está no código de desenvolvimento, sem publicação ou tag. Não há instalação pelo npm registry.</div>
    <h2>Escolha seu caminho</h2>
    <div className="docs-card-grid">
      <a className="docs-card" href="#/docs/install"><strong>Instalar</strong><span>Node.js 22+, clone da tag estável e npm link.</span></a>
      <a className="docs-card" href="#/docs/workflow"><strong>Entender o ciclo</strong><span>Planejamento, implementação, verificação e recuperação.</span></a>
      <a className="docs-card" href="#/examples"><strong>Ver exemplos</strong><span>Pedidos naturais e opções reais da CLI.</span></a>
    </div>
    <h2>O fluxo em uma linha</h2>
    <Code>{`pedido → planejamento → construção → código → verificação → concluído
                                            ↘ falha → depuração → código → verificação`}</Code>
    <p>Pedidos informativos e somente leitura ficam fora do ciclo. Comandos explícitos <code>guarana:*</code> continuam disponíveis para executar uma etapa específica.</p>
    <SourceLinks paths={ [['README e início rápido', 'README.md'], ['Orquestração automática', 'docs/reference/orchestrator.md'], ['Política de releases', 'RELEASING.md']] } />
  </>;
}

function InstallPage() {
  return <>
    <p className="docs-lead">Requisitos: Node.js 22 ou mais recente e OpenCode. A tag estável é <code>v1.5.0</code>; o CLI é vinculado ao checkout local, não baixado do npm.</p>
    <h2>Instalação global</h2>
    <Code>{`git clone --depth 1 --branch v1.5.0 \\
  https://github.com/leorsousa05/guarana.git
cd guarana
npm link
guarana install`}</Code>
    <p><code>npm link</code> registra este checkout local globalmente. Mantenha a pasta clonada disponível enquanto usar o comando <code>guarana</code>.</p>
    <h2>Instalação no projeto atual</h2>
    <Code>{`guarana install --project
guarana list --project
guarana plugin status --project`}</Code>
    <p>O escopo <code>--project</code> instala skills em <code>.opencode/skills/</code> e plugins em <code>.opencode/plugins/</code> no diretório atual. Sem a opção, os destinos são os diretórios do usuário.</p>
    <h2>Verificar</h2>
    <Code>{`guarana list
guarana plugin status
guarana --version`}</Code>
    <SourceLinks paths={ [['Instruções oficiais', 'README.md'], ['Tags e política de release', 'RELEASING.md'], ['Código-fonte no GitHub', 'package.json']] } />
  </>;
}

function QuickStartPage() {
  return <>
    <p className="docs-lead">Depois da instalação, abra uma nova sessão do OpenCode no projeto. Descreva uma tarefa concreta; não é necessário chamar uma skill para iniciar o fluxo automático.</p>
    <h2>Experimente um pedido de engenharia</h2>
    <Code>{`"Adicione validação de e-mail ao formulário de cadastro.
Inclua testes para valores válidos, inválidos e vazios."`}</Code>
    <p>Guarana restaura o checkpoint, planeja, implementa e pede verificação independente. Acompanhe o estado no OpenCode ou abra o Dashboard local:</p>
    <Code>{`guarana web
# abre http://127.0.0.1:4200`}</Code>
    <p>Para selecionar outra porta ou manter o navegador fechado: <code>guarana web --port 4300 --no-open</code>. As preferências podem ser salvas; opções de linha de comando valem só para aquela execução.</p>
    <h2>O que é criado</h2>
    <Code>{`.specs/
├── README.md                    # índice e tracker
├── state/
│   ├── project-state.md         # checkpoint durável
│   └── workflow.json            # estado operacional do ciclo
├── decisions/                   # ADRs append-only
└── features/                    # critérios de aceitação
.guarana/memory/                 # vault de conhecimento do projeto`}</Code>
    <p>Guarana cria apenas arquivos ausentes e não sobrescreve conteúdo existente. Registros humanos em <code>.specs/</code> só são criados por pedido explícito ou quando a descoberta identifica uma necessidade durável; o estado operacional pode ser criado para retomar o ciclo.</p>
    <SourceLinks paths={ [['Quick Start', 'README.md'], ['Referência de orquestração', 'docs/reference/orchestrator.md']] } />
  </>;
}

function UpdatePage() {
  return <>
    <p className="docs-lead">Os comandos de instalação e atualização usam os recursos incluídos no CLI. Atualize o clone para outra versão antes de repetir a instalação.</p>
    <h2>Atualizar do checkout atual</h2>
    <Code>{`cd /caminho/para/guarana
git fetch --tags
git checkout v1.5.0
npm link
guarana update
# ou apenas no projeto atual:
guarana update --project`}</Code>
    <p><code>update</code> reinstala a partir das skills empacotadas pelo CLI. Para atualização do projeto, <code>--project</code> seleciona os destinos locais.</p>
    <h2>Desinstalar</h2>
    <Code>{`guarana uninstall
guarana uninstall --project`}</Code>
    <p>Para remover apenas plugins e preservar engines, perfis nativos e os respectivos grupos do manifesto:</p>
    <Code>{`guarana plugin uninstall --plugins-only
guarana plugin uninstall --plugins-only --project`}</Code>
    <p>Os guardas de propriedade são intencionais. Não use instalação ou desinstalação como forma de forçar arquivos de plugin modificados; consulte <a href="#/docs/security">segurança e recuperação</a>.</p>
    <SourceLinks paths={ [['Comandos de gerenciamento', 'cli/command-metadata.js'], ['Ajuda completa da CLI', 'cli/help.js'], ['README', 'README.md']] } />
  </>;
}

function WorkflowPage() {
  return <>
    <p className="docs-lead">Pedidos de produto, código ou configuração entram no ciclo automaticamente. Perguntas informativas e tarefas somente leitura permanecem em repouso e não criam registros de tarefa.</p>
    <h2>Etapas e estado</h2>
    <Code>{`idle → planning → building → coding → verifying → completed
                                  ↑                  ↓ falha
                                  └──── debugging ←──┘`}</Code>
    <p>O estado vivo fica em <code>.specs/state/workflow.json</code>. Ao retomar em outra sessão, o sistema lê o disco em vez de reconstruir o checkpoint pela memória da conversa.</p>
    <h2>Recuperação de uma verificação que falhou</h2>
    <ol><li>A falha na verificação leva o fluxo a <code>debugging</code>.</li><li>O diagnóstico identifica a causa e uma correção acionável.</li><li>A implementação retorna a <code>coding</code>, depois passa por nova verificação.</li><li>Só um resultado independente aprovado chega a <code>completed</code>.</li></ol>
    <h2>Skills explícitas</h2>
    <p>Para pedir uma etapa específica, use por exemplo <code>guarana:plan</code>, <code>guarana:code</code>, <code>guarana:verify</code> ou <code>guarana:remember</code>. A chamada explícita é um escape hatch; não substitui a separação entre quem implementa e quem verifica.</p>
    <h2>Preferências de automação</h2>
    <Code>{`guarana workflow read
guarana workflow set verify false --project
guarana workflow clear verify --project`}</Code>
    <p>Specs e verificação independente ficam habilitados por padrão. Valores de projeto prevalecem sobre os globais; limpar um valor local restaura a herança.</p>
    <SourceLinks paths={ [['Ciclo e eventos', 'docs/reference/orchestrator.md'], ['Falhas e recuperação', 'docs/reference/failure-modes.md'], ['Gatilhos do ciclo externo', 'docs/reference/outer-loop-triggers.md']] } />
  </>;
}

function CliPage() {
  return <>
    <p className="docs-lead">A referência abaixo espelha as famílias e flags do CLI. Use <code>guarana --help</code> ou <code>-h</code> para o resumo; <code>memory</code>, <code>specs</code> e <code>workflow</code> também oferecem ajuda detalhada com <code>--help</code> ou <code>-h</code>.</p>
    <h2>Suite e plugins</h2>
    <Code>{`guarana install|update|list|uninstall [--project]
guarana plugin install [--project] [--plugins-only]
guarana plugin uninstall [--project] [--plugins-only]
guarana plugin adopt <plugin-file> --accept-current [--project]
guarana plugin status [--project]`}</Code>
    <p><code>--project</code> seleciona destinos no diretório atual. <code>--plugins-only</code> limita a instalação a plugins e engines, preservando perfis nativos; na desinstalação remove somente os plugins e seu grupo do manifesto.</p>
    <h2>Advisor e Dashboard</h2>
    <Code>{`guarana advisor models [provider]
guarana advisor read [--project]
guarana advisor set <field> <id> [--project]
guarana advisor clear [field] [--project]
guarana advisor status [--project]
guarana web [--port N] [--open|--no-open]`}</Code>
    <p>Campos do advisor: <code>primary.provider</code>, <code>primary.model</code>, <code>primary.variant</code>, <code>advisor.provider</code>, <code>advisor.model</code>, <code>advisor.variant</code> e <code>advisor.enabled</code>. Modelos listados são os provedores conectados ao OpenCode.</p>
    <h2>Memória</h2>
    <Code>{`guarana memory init|status
guarana memory search [term] [--type <type>] [--project <hash>]
  [--since <date|ms>] [--until <date|ms>] [--limit <n>]
guarana memory export <file>
guarana memory import <file>
guarana memory compact [--threshold <n>]
guarana memory prune --keep <n>
guarana memory review --list
guarana memory review <id> --confirm --type <decision|bug|solution|refactor>
guarana memory review <id> --discard
guarana memory delete <id> --scope <project|global> --confirm
guarana memory --help | -h`}</Code>
    <p>Filtros de <code>--type</code>: <code>decision|bug|solution|refactor|atom|supernode</code>. O limite padrão da busca é 20. <code>compact</code> e <code>prune</code> preservam os registros legados; são no-op seguros. Revisão de draft aceita conversão com <code>--intent "..."</code> e/ou <code>--tags a,b</code>. <code>delete</code> é permanente e exige ID exato, escopo explícito e confirmação.</p>
    <p><code>export</code> grava o vault em JSON; <code>import</code> substitui os nós e arestas pelo conteúdo importado. Confirme o arquivo antes de importar.</p>
    <p>Memória usa sempre <code>.guarana/memory/</code> do diretório atual. Um <code>--project</code> global não troca o vault. Em busca, <code>--project HASH</code> é um filtro de hash e vem depois de <code>search</code>.</p>
    <h2>Specs e workflow</h2>
    <Code>{`guarana specs validate [project-root] [--json]
guarana specs record --stdin
guarana specs record --file .specs/state/worker-specs-handoff.json
guarana specs --help | -h

guarana workflow read [--project]
guarana workflow set <specs|verify|memory.autoInject> <true|false> [--project]
guarana workflow set memory.preferenceInjectionBudgetTokens <positive-integer> [--project]
guarana workflow clear [specs|verify|memory.autoInject|memory.preferenceInjectionBudgetTokens] [--project]
guarana workflow --help | -h

guarana --help | -h
guarana --version | -v`}</Code>
    <p><code>specs validate</code> pode emitir JSON e retorna código de saída 1 quando encontra erros. <code>record --stdin</code> lê handoff de schema v1 ou atualização de issue conhecida schema v2; <code>--file</code> usa e remove o arquivo fixo. Operações combinadas de tarefa e issue são atômicas; payloads acima de 64 KiB e destinos com symlink são rejeitados.</p>
    <SourceLinks paths={ [['Metadados canônicos de comandos', 'cli/command-metadata.js'], ['Ajuda da CLI', 'cli/help.js'], ['Referência no README', 'README.md']] } />
  </>;
}

function SkillsPage() {
  const skills = [
    ['plan', 'development', 'Restaura estado, resolve lacunas de requisito importantes e despacha o próximo passo.', 'Início de tarefa, “onde paramos?” ou escolha do próximo passo.'],
    ['build', 'automation', 'Executa o ciclo Frame → Run → Verify → Record, com gatilhos, orçamento e condições de parada.', 'Iniciar ou executar uma rodada; orçamento e stop reasons.'],
    ['code', 'development', 'Implementa uma condição verificada com leitura prévia e diff mínimo.', 'Implementar, editar ou escrever código.'],
    ['verify', 'development', 'Valida de forma independente a condição de aceitação e reúne provas.', 'Checar trabalho, aceitação ou perguntar se está pronto.'],
    ['research', 'research', 'Investiga evidências dentro de limites somente de leitura.', 'Investigar, rastrear ou comparar evidências sem editar.'],
    ['remember', 'memory', 'Restaura e registra estado do projeto e checkpoints duráveis.', 'Retomar projeto, recuperar contexto ou registrar progresso.'],
    ['memory', 'memory', 'Busca, revisa e salva conhecimento durável no grafo.', 'Consultar decisões, bugs e soluções; salvar conhecimento.'],
    ['skill-authoring', 'memory', 'Cria e atualiza skills reutilizáveis sem duplicatas.', 'Criar ou manter uma skill gerada pelo Guarana.'],
    ['memory-maintenance', 'memory', 'Audita e mantém grafos de memória com segurança.', 'Auditar, migrar ou podar memória durável.'],
    ['debug', 'development', 'Skill opcional de matriz de falhas e defusals.', 'Somente quando um teste falha ou uma execução se comporta mal.'],
    ['measure', 'automation', 'Skill opcional para telemetria, stop reasons e saúde de orçamento.', 'Somente ao ajustar custo ou ler telemetria.'],
  ];
  return <>
    <p className="docs-lead">O índice carregado é compacto; o corpo da skill só é lido quando o gatilho corresponde. Categoria descreve o assunto. Escopo (<code>project</code> ou <code>global</code>) descreve onde a suite está instalada.</p>
    <div className="docs-table-wrap"><table><thead><tr><th>Skill explícita</th><th>Categoria</th><th>Responsabilidade e gatilho</th></tr></thead><tbody>{skills.map(([name, category, description, trigger]) => <tr key={name}><td><code>guarana:{name}</code></td><td>{category}</td><td>{description}<br /><small><strong>Quando:</strong> {trigger}</small></td></tr>)}</tbody></table></div>
    <p>O orquestrador automático já seleciona as skills apropriadas para pedidos de engenharia. Use comandos explícitos como escape hatch, não como requisito para iniciar uma tarefa.</p>
    <SourceLinks paths={ [['Índice canônico', 'skills/guarana/SKILL.md'], ['Exemplo de corpo de skill', 'skills/guarana/skills/plan/SKILL.md'], ['Como trabalhar com skills', 'README.md']] } />
  </>;
}

function MemoryPage() {
  return <>
    <p className="docs-lead">Arquivos no disco são a fonte de verdade. Specs e estado operacional ficam no projeto; o grafo de conhecimento também é local e pesquisável. Preferências globais ficam no vault privado do usuário, fora do repositório.</p>
    <h2>O que vive em cada lugar</h2>
    <Code>{`.specs/                    status, checkpoints, ADRs e aceitação
.guarana/memory/           grafo de conhecimento do projeto (gitignored)
vault global do usuário    preferências pessoais confirmadas`}</Code>
    <p>O vault usa <code>nodes.jsonl</code>, <code>edges.jsonl</code> e <code>config.json</code>. Decisões, bugs, soluções e refactors são consultados sob demanda; não são injetados no prompt automaticamente.</p>
    <h2>Injeção de preferências</h2>
    <p>Novas preferências usam as categorias <code>agent_behavior</code>, <code>workflow</code> ou <code>communication</code>; preferências confirmadas nessas categorias podem ser elegíveis. Preferências Globais confirmadas legadas sem categoria armazenada continuam elegíveis como <code>general</code>, sem reescrita do vault; preferências de projeto sem categoria continuam excluídas. Preferências de projeto precedem preferências globais; contexto relacionado é limitado a um salto e grupos de confiança permanecem separados. Registros são incluídos inteiros se couberem no orçamento; os maiores que não cabem são omitidos sem truncamento.</p>
    <Code>{`guarana workflow set memory.autoInject false --project
guarana workflow clear memory.autoInject --project
guarana workflow set memory.preferenceInjectionBudgetTokens 1200
guarana workflow clear memory.preferenceInjectionBudgetTokens`}</Code>
    <p>Desativar injeção não desativa a busca explícita. O orçamento é um inteiro positivo; se não houver orçamento utilizável, a injeção falha fechada. Comparar bytes UTF-8 com tokens é uma estimativa, não tokenização exata nem capacidade restante da conversa.</p>
    <h2>Busca e revisão explícitas</h2>
    <Code>{`guarana memory status
guarana memory search "decisão" --type decision --limit 10
guarana memory review --list
guarana memory review <id> --confirm --type solution`}</Code>
    <p>O comando <code>delete</code> remove definitivamente um registro confirmado e suas arestas; só use depois de conferir o ID e declarar <code>--scope project|global --confirm</code>. Rascunhos antigos nunca aparecem na busca de confirmados.</p>
    <SourceLinks paths={ [['Modelo de memória', 'docs/reference/memory.md'], ['Comandos e limites da memória', 'cli/command-metadata.js'], ['Política de privacidade no README', 'README.md']] } />
  </>;
}

function DashboardPage() {
  return <>
    <p className="docs-lead">O Dashboard operacional é local e separado deste portal público. Execute a partir da raiz do projeto com <code>guarana web</code>; o servidor abre em <code>http://127.0.0.1:4200</code> e escuta somente no loopback.</p>
    <h2>Superfícies</h2>
    <ul><li><strong>Overview, Activity e Runs:</strong> visão do projeto, atividade e execuções.</li><li><strong>Specs e Workflow:</strong> registros e estado do ciclo.</li><li><strong>Memory e Skills:</strong> consulta dos vaults e da suite instalada.</li><li><strong>Settings:</strong> modelos Primary/Advisor e preferências de Workflow/Web.</li></ul>
    <h2>Porta e navegador</h2>
    <Code>{`guarana web --port 4300 --no-open
guarana web --open`}</Code>
    <p>Preferências persistidas de porta e abertura do navegador vivem separadamente em <code>.guarana/web.json</code> (projeto) ou <code>$XDG_CONFIG_HOME/guarana/web.json</code> (global; padrão <code>~/.config/guarana/web.json</code>). Flags de execução substituem as preferências salvas somente naquela execução.</p>
    <h2>Modelos e settings</h2>
    <p>Advisor permite escolher provedor/modelo/variante e habilitar ou desabilitar consultas. Primary configura defaults dos perfis/agentes gerados; seleção de modelo ou variante explícita ou lembrada na sessão OpenCode prevalece. Configurações de workflow têm escopo global ou de projeto e são validadas antes de gravar; o Dashboard não mescla arquivos de configuração existentes.</p>
    <Code>{`guarana advisor models
guarana advisor set primary.provider <provider-id>
guarana advisor set primary.model <model-id>
guarana advisor status
guarana workflow read --project`}</Code>
    <p>A troca de projeto é limitada às raízes permitidas pelo servidor. “Add this project” registra o projeto do qual Guarana foi iniciado; o browser não fornece um caminho arbitrário.</p>
    <SourceLinks paths={ [['Dashboard no README', 'README.md'], ['Rotas de settings Web', 'dashboard/server/routes/web-settings.js'], ['Rotas de workflow', 'dashboard/server/routes/workflow.js']] } />
  </>;
}

function SecurityPage() {
  return <>
    <p className="docs-lead">O site de documentação é estático; não recebe dados do Dashboard. A aplicação operacional local tem fronteiras próprias e não deve ser exposta como serviço público.</p>
    <h2>Boas práticas</h2>
    <ul><li>Execute o Dashboard localmente e mantenha o bind loopback padrão; não o trate como uma API remota.</li><li>Use escopos de projeto apenas em diretórios confiáveis e revise os arquivos que serão criados.</li><li>Revise o conteúdo atual de um plugin marcado antes de adotar sua propriedade.</li><li>Não compartilhe vault global: ele contém preferências pessoais e fica separado dos arquivos do projeto.</li></ul>
    <h2>Recuperar plugin modificado</h2>
    <p><code>guarana plugin adopt</code> não é um “force”. É uma transição explícita de propriedade de um único plugin allowlisted. Exige arquivo regular existente, marcador Guarana, entrada válida no manifesto, bytes diferentes do hash registrado e confirmação.</p>
    <Code>{`# Primeiro revise o arquivo e identifique o plugin allowlisted.
guarana plugin adopt guarana-orchestrator.js --accept-current
guarana plugin status`}</Code>
    <p>A adoção atualiza somente o hash da entrada no manifesto; não altera bytes do plugin nem outras entradas. Instalação/desinstalação normais continuam recusando modificações rastreadas.</p>
    <h2>Diagnóstico rápido</h2>
    <ul><li><strong>CLI ausente:</strong> confirme Node 22+, diretório do clone e <code>npm link</code>; rode <code>guarana --version</code>.</li><li><strong>Suite inconsistente:</strong> consulte <code>guarana list</code> e <code>guarana plugin status</code> antes de reinstalar.</li><li><strong>Dashboard não abre:</strong> verifique a porta (<code>guarana web --port 4300</code>) e dependências do checkout; a primeira execução pode reparar dependências empacotadas.</li><li><strong>Teste ou ciclo falha:</strong> registre a mensagem reproduzível e use <code>guarana:debug</code> após uma falha real.</li><li><strong>Contexto não é injetado:</strong> leia a preferência efetiva com <code>guarana workflow read</code>; injection desabilitada não impede busca explícita.</li></ul>
    <SourceLinks paths={ [['Contrato de adoção e help', 'cli/help.js'], ['Modos de falha', 'docs/reference/failure-modes.md'], ['README', 'README.md']] } />
  </>;
}

function ArchitecturePage() {
  return <>
    <p className="docs-lead">A arquitetura separa o loop host-independent dos adaptadores OpenCode, CLI e dados persistidos. A suite é instalável sem manter este repositório no ambiente de execução: o CLI empacota skills, plugins e engines necessários.</p>
    <h2>Componentes do repositório</h2>
    <Code>{`skills/guarana/       índice e procedimentos
orchestrator/         máquina de estados reutilizável
memory/               grafo persistente e busca
plugin/               adaptadores de hooks e ferramentas OpenCode
cli/                  instalador autocontido e superfícies CLI
dashboard/            app operacional local
docs/reference/       referências de engenharia
.specs/               especificações, decisões e estado`}</Code>
    <h2>Integração com OpenCode</h2>
    <p>O plugin de orquestração integra hooks como <code>chat.message</code>, <code>experimental.chat.system.transform</code> e <code>tool.execute.after</code>, além das ferramentas de workflow. A lógica de decisão vive em <code>orchestrator/</code>. Para código e verificação, OpenCode Task executa workers em contextos separados; o worker que altera não aprova o próprio trabalho.</p>
    <h2>Persistência e divulgação progressiva</h2>
    <p>O índice de skills mantém metadados compactos; apenas o corpo acionado é carregado. Estado operacional e conhecimento ficam no disco, em formatos inspecionáveis. O Dashboard é uma interface de leitura/gestão local, não o portal público.</p>
    <SourceLinks paths={ [['Arquitetura do runtime', '.specs/architecture.md'], ['Orquestração', 'docs/reference/orchestrator.md'], ['Referência React/OpenCode e memória', 'docs/reference/memory.md'], ['Layout do projeto', 'README.md']] } />
  </>;
}

function DevelopmentPage() {
  return <>
    <p className="docs-lead">Desenvolva em Node.js 22 ou 24. O código principal não precisa de dependências externas; o Dashboard e o portal têm instalações isoladas.</p>
    <h2>Preparar e validar</h2>
    <Code>{`git clone https://github.com/leorsousa05/guarana.git
cd guarana
npm ci --prefix dashboard
npm test
npm run build
npm run check-cli
npm run specs:validate`}</Code>
    <p>O CI valida Node 22.x e 24.x. Para o site, instale dependências no app separado e compile:</p>
    <Code>{`npm ci --prefix docs-site
npm run build --prefix docs-site
npm run preview --prefix docs-site`}</Code>
    <h2>Sincronizar CLI empacotado</h2>
    <Code>{`npm run build
npm run check-cli`}</Code>
    <p><code>npm run build</code> compila o Dashboard e sincroniza fontes canônicas ao bundle do CLI; <code>check-cli</code> detecta divergências antes de empacotar.</p>
    <h2>Contribuir</h2>
    <ol><li>Abra uma issue ou descreva o comportamento esperado e uma condição verificável.</li><li>Faça a menor mudança que satisfaça a condição; leia os arquivos antes de editar.</li><li>Rode os testes mais próximos primeiro, depois os checks de CI afetados.</li><li>Confira <code>git diff --check</code> e o escopo do diff; não inclua saídas geradas que não pertençam à mudança.</li><li>Envie uma proposta de contribuição com motivação, comportamento, checks executados e limitações conhecidas.</li></ol>
    <p>Não execute smoke tests como substituto dos checks ordinários de release; consulte a política canônica antes de preparar uma release.</p>
    <SourceLinks paths={ [['Scripts e desenvolvimento', 'README.md'], ['Workflow de CI', '.github/workflows/ci.yml'], ['Sincronização do CLI', 'scripts/sync-cli-bundle.mjs'], ['Política de releases', 'RELEASING.md']] } />
  </>;
}

function PagesPage() {
  return <>
    <p className="docs-lead">Este portal é um app React/Vite estático em <code>docs-site/</code>. Não é uma migração para Docusaurus; o padrão de navegação é uma referência de experiência.</p>
    <h2>Base e artefato</h2>
    <p>O Vite usa a base <code>/guarana/</code>, correspondente ao nome do repositório no GitHub Pages. A saída de produção é <code>docs-site/dist/</code>; links de assets devem preservar essa base.</p>
    <Code>{`npm ci --prefix docs-site
npm run build --prefix docs-site
# conferir localmente:
npm run preview --prefix docs-site`}</Code>
    <h2>Publicação e configuração</h2>
    <p>O workflow separado de Pages roda somente em push para <code>main</code>, constrói o portal e publica apenas <code>docs-site/dist</code>. O build tem permissão de leitura de conteúdo; o deploy recebe somente <code>pages: write</code> e <code>id-token: write</code>.</p>
    <p>Se Pages ainda não estiver habilitado no repositório, a pessoa mantenedora deve abrir <strong>Settings → Pages</strong> e selecionar <strong>GitHub Actions</strong>. Este trabalho local não faz deploy nem altera configuração remota.</p>
    <SourceLinks paths={ [['Workflow de Pages', '.github/workflows/pages.yml'], ['Configuração Vite', 'docs-site/vite.config.js'], ['README do projeto', 'README.md']] } />
  </>;
}

function ExamplesPage() {
  return <>
    <p className="docs-lead">Use estes exemplos como ponto de partida; ajuste caminhos, critérios e nomes ao seu projeto. Pedidos naturais iniciam o ciclo sem precisar chamar uma skill manualmente.</p>
    <h2>Uma tarefa de produto com critério explícito</h2>
    <Code>{`"Adicione um filtro por status à lista de pedidos.
Mantenha a seleção na URL e escreva testes para os estados vazio,
carregando e com resultados."`}</Code>
    <p>O critério claro ajuda a etapa de verificação a provar comportamento, não apenas compilação.</p>
    <h2>Continuar trabalho após trocar de sessão</h2>
    <Code>{`"Retome a tarefa do checkpoint do projeto. Primeiro confirme
o estado atual no disco e identifique o próximo passo verificável."`}</Code>
    <p>Para comandar etapas explicitamente: <code>guarana:remember</code>, <code>guarana:plan</code>, <code>guarana:build</code> ou <code>guarana:verify</code>.</p>
    <h2>Instalação local e estado de saúde</h2>
    <Code>{`guarana install --project
guarana list --project
guarana plugin status --project`}</Code>
    <h2>Configurar ciclo e memória</h2>
    <Code>{`guarana workflow read --project
guarana workflow set verify true --project
guarana workflow set memory.autoInject false --project
guarana workflow clear memory.autoInject --project`}</Code>
    <h2>Escolher modelos e abrir Dashboard</h2>
    <Code>{`guarana advisor models
guarana advisor set primary.provider <provider-id>
guarana advisor set primary.model <model-id>
guarana web --port 4300 --no-open`}</Code>
    <h2>Pesquisar memória sem apagar dados</h2>
    <Code>{`guarana memory status
guarana memory search "autenticação" --type decision --limit 10
guarana memory search "checkout" --project <project-hash>`}</Code>
    <p>A opção <code>--project</code> após <code>memory search</code> filtra por hash; ela não escolhe o vault. Evite <code>memory delete</code> até confirmar o ID e o escopo pretendidos.</p>
    <SourceLinks paths={ [['CLI e configuração', 'README.md'], ['Comandos canônicos', 'cli/command-metadata.js'], ['Gatilhos do workflow', 'docs/reference/outer-loop-triggers.md']] } />
  </>;
}

function DocumentationSite() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/(docs\/)?/, '') || 'start');
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const page = route === 'examples' ? examplesPage : allPages.find((item) => item.id === route) || allPages[0];
  const searchResults = query.trim()
    ? [examplesPage, ...allPages].filter((item) => `${item.title} ${item.description} ${item.keywords}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))
    : [];

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#/docs') && !hash.startsWith('#/examples')) return;
      const next = hash.replace(/^#\/(docs\/)?/, '') || 'start';
      setRoute(next);
      setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setQuery('');
        setMenuOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    document.querySelector('.docs-article h1')?.focus();
  }, [page.id]);

  const routeHref = (id) => id === 'examples' ? '#/examples' : `#/docs/${id}`;

  return (
    <div className="docs-app">
      <a className="skip-link" href="#docs-content">Pular para a documentação</a>
      <header className="docs-header">
        <a className="docs-brand" href="#inicio"><span className="wordmark-mark" aria-hidden="true">g</span> guarana <span className="docs-brand-divider">/</span> docs</a>
        <div className="docs-header-actions">
          <a href="#inicio">Página inicial</a>
          <a href="#/examples">Exemplos</a>
          <a href={repository} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </header>
      <div className="docs-toolbar">
        <button className="docs-menu-button" type="button" aria-expanded={menuOpen} aria-controls="docs-sidebar" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? 'Fechar navegação' : 'Navegação'}
        </button>
        <label className="docs-search">
          <span className="sr-only">Buscar na documentação</span>
          <span aria-hidden="true">⌕</span>
          <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar documentação…" aria-controls="docs-search-results" />
          <kbd>Ctrl K</kbd>
          {query.trim() && <div className="docs-search-results" id="docs-search-results" role="region" aria-label="Resultados da busca">
            {searchResults.length ? searchResults.map((result) => <a key={result.id} href={routeHref(result.id)} onClick={() => setQuery('')}><strong>{result.title}</strong><span>{result.description}</span></a>) : <p>Nenhum tópico encontrado. Tente outro termo.</p>}
          </div>}
        </label>
      </div>
      <div className="docs-layout">
        <aside className={`docs-sidebar${menuOpen ? ' is-open' : ''}`} id="docs-sidebar" aria-label="Navegação dos tópicos">
          <nav>
            {guides.map(({ group, pages }) => <section className="docs-nav-group" key={group} aria-label={group}>
              <h2>{group}</h2>
              {pages.map((item) => <a key={item.id} href={routeHref(item.id)} aria-current={page.id === item.id ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{item.title}</a>)}
            </section>)}
            <section className="docs-nav-group" aria-label="Prática">
              <h2>Prática</h2>
              <a href="#/examples" aria-current={page.id === 'examples' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Exemplos práticos</a>
            </section>
          </nav>
          <p className="docs-sidebar-note">Fonte canônica: repositório Guarana</p>
        </aside>
        <main className="docs-article" id="docs-content">
          <div className="docs-breadcrumb"><a href="#/docs/start">Documentação</a><span aria-hidden="true">/</span><span>{page.title}</span></div>
          <article>
            <h1 tabIndex="-1">{page.title}</h1>
            <p className="docs-summary">{page.description}</p>
            {page.body}
          </article>
          <nav className="docs-page-nav" aria-label="Navegação entre páginas">
            {(() => {
              const index = [...allPages, examplesPage].findIndex((item) => item.id === page.id);
              const pageOrder = [...allPages, examplesPage];
              return <>
                {index > 0 ? <a href={routeHref(pageOrder[index - 1].id)}><span>Anterior</span><strong>{pageOrder[index - 1].title}</strong></a> : <span />}
                {index < pageOrder.length - 1 ? <a className="docs-next" href={routeHref(pageOrder[index + 1].id)}><span>Próxima</span><strong>{pageOrder[index + 1].title}</strong></a> : <span />}
              </>;
            })()}
          </nav>
        </main>
      </div>
      <footer className="docs-footer">
        <a href="#inicio">Guarana</a><span>Documentação em português · conteúdo do repositório é a fonte canônica.</span>
      </footer>
    </div>
  );
}

export { DocumentationSite };
