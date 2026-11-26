import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentationSite } from './docs.jsx';
import './styles.css';

const repository = 'https://github.com/leorsousa05/guarana';
const source = (path) => `${repository}/blob/main/${path}`;

function Header() {
  return (
    <header className="site-header">
      <a className="wordmark" href="#inicio" aria-label="Guarana, início">
        <span className="wordmark-mark" aria-hidden="true">g</span>
        <span>guarana</span>
      </a>
      <nav aria-label="Navegação principal">
        <a href="#ciclo">O ciclo</a>
        <a href="#capacidades">O que faz</a>
        <a href="#skills">Skills</a>
        <a href="#memoria">Memória</a>
        <a href="#/docs/start">Documentação</a>
        <a href="#/examples">Exemplos</a>
        <a className="nav-source" href={repository}>Repositório <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="inicio" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="kicker"><span className="kicker-dot" aria-hidden="true" /> Engenharia em ciclo para OpenCode</p>
        <h1 id="hero-title">Do pedido ao <em>feito.</em><br />Com prova no caminho.</h1>
        <p className="hero-intro">
          Guarana transforma pedidos naturais em um fluxo de trabalho
          verificável. O estado fica no disco; cada etapa deixa claro o que
          vem a seguir.
        </p>
        <div className="hero-actions">
          <a className="button button-red" href="#instalacao">Começar pela instalação</a>
          <a className="portal-entry-link" href="#/docs/start">Documentação</a>
          <a className="portal-entry-link" href="#/examples">Exemplos práticos</a>
          <a className="text-link" href={source('README.md')}>Ler o README <span aria-hidden="true">↗</span></a>
        </div>
        <p className="hero-meta">Node.js 22+ <span aria-hidden="true">/</span> OpenCode <span aria-hidden="true">/</span> MIT</p>
      </div>
      <figure className="hero-figure">
        <div className="figure-index"><span>01</span> fruto, não atalho</div>
        <div className="fruit-frame">
          <span className="fruit-orbit fruit-orbit-one" aria-hidden="true" />
          <span className="fruit-orbit fruit-orbit-two" aria-hidden="true" />
          <img
            src={`${import.meta.env.BASE_URL}guarana.png`}
            alt="Ilustração de um ramo de guaraná com folhas verdes e frutos vermelhos"
            width="512"
            height="512"
          />
        </div>
        <figcaption>Planejar. Construir. Verificar. Lembrar.</figcaption>
      </figure>
      <a className="skip-down" href="#ciclo">Explore o ciclo <span aria-hidden="true">↓</span></a>
    </section>
  );
}

function ReleaseNote() {
  return (
    <aside className="release-note" aria-label="Status de lançamento">
      <span className="release-mark" aria-hidden="true">●</span>
      <p><strong>Versão estável: v1.5.0.</strong> A versão 1.5.4 está no código de <code>main</code> como candidata, ainda sem publicação ou tag.</p>
      <a href={source('CHANGELOG.md')}>Ver changelog <span aria-hidden="true">↗</span></a>
    </aside>
  );
}

function Workflow() {
  const phases = [
    ['Planejar', 'Entende o pedido, recupera o estado e define uma condição verificável.'],
    ['Construir', 'Escolhe o próximo passo e prepara o trabalho sem perder o contexto.'],
    ['Codificar', 'Implementa a condição com mudanças pequenas e delimitadas.'],
    ['Verificar', 'Confere a aceitação de forma independente antes de concluir.'],
  ];

  return (
    <section className="section workflow-section" id="ciclo" aria-labelledby="workflow-title">
      <div className="section-heading">
        <p className="kicker">Uma sequência com retorno</p>
        <h2 id="workflow-title">O trabalho não termina<br />quando o código compila.</h2>
        <p>Um pedido natural inicia o fluxo automaticamente. Falhas de verificação voltam para correção — e passam por uma nova verificação.</p>
      </div>
      <ol className="phase-list">
        {phases.map(([name, description], index) => (
          <li className="phase" key={name}>
            <span className="phase-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h3>{name}</h3>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="workflow-return">
        <span className="return-line" aria-hidden="true" />
        <p><strong>Verificação falhou?</strong> O fluxo entra em depuração, volta à codificação e verifica de novo.</p>
      </div>
      <div className="workflow-foot">
        <p>O estado operacional persiste em <code>.specs/state/workflow.json</code> e pode ser retomado entre turnos e sessões.</p>
        <a href={source('docs/reference/orchestrator.md')}>Como funciona a orquestração <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="section capabilities-section" id="capacidades" aria-labelledby="capabilities-title">
      <div className="section-topline">
        <p className="kicker">Uma ferramenta, vários registros</p>
        <span className="section-number" aria-hidden="true">02</span>
      </div>
      <h2 id="capabilities-title">O contexto também<br />faz parte da entrega.</h2>
      <div className="capability-grid">
        <article className="capability capability-main">
          <span className="capability-glyph" aria-hidden="true">↻</span>
          <h3>Orquestração automática</h3>
          <p>Pedidos de produto, código ou configuração entram no ciclo; perguntas informativas e somente leitura permanecem fora dele. Comandos explícitos <code>guarana:*</code> continuam disponíveis como atalho.</p>
          <a href={source('docs/reference/orchestrator.md')}>Referência do ciclo <span aria-hidden="true">↗</span></a>
        </article>
        <article className="capability capability-paper">
          <span className="capability-glyph" aria-hidden="true">⌘</span>
          <h3>Ferramentas no terminal</h3>
          <p>Instale skills e plugins, consulte o estado ou abra o Dashboard local com <code>guarana web</code>. O Dashboard é operacional e local — não é este site público.</p>
          <a href={source('README.md#cli-reference')}>Comandos e Dashboard <span aria-hidden="true">↗</span></a>
        </article>
        <article className="capability capability-leaf">
          <span className="capability-glyph" aria-hidden="true">⌁</span>
          <h3>Progresso que sobrevive</h3>
          <p>O fluxo e as decisões importantes ficam em arquivos Markdown e JSON inspecionáveis. Ao retomar o trabalho, Guarana restaura o checkpoint do disco.</p>
          <a href={source('docs/reference/memory.md')}>Modelo de memória <span aria-hidden="true">↗</span></a>
        </article>
      </div>
    </section>
  );
}

function Installation() {
  return (
    <section className="section install-section" id="instalacao" aria-labelledby="install-title">
      <div className="install-copy">
        <p className="kicker">Comece pela versão marcada</p>
        <h2 id="install-title">Instale da fonte estável.</h2>
        <p>Guarana exige Node.js 22 ou mais recente e funciona com o OpenCode. A versão estável indicada é a tag <code>v1.5.0</code>; não há instalação por npm.</p>
        <p>O <code>npm link</code> registra o CLI deste checkout na sua máquina. Mantenha a cópia clonada disponível enquanto usar o comando.</p>
        <a className="text-link" href={source('RELEASING.md')}>Leia a política de releases <span aria-hidden="true">↗</span></a>
      </div>
      <div className="install-steps" aria-label="Comandos de instalação">
        <div className="code-block">
          <p className="code-label"><span aria-hidden="true">●</span> Instalação global</p>
          <pre><code>git clone --depth 1 --branch v1.5.0 \<br />  https://github.com/leorsousa05/guarana.git<br />cd guarana<br />npm link<br />guarana install</code></pre>
        </div>
        <div className="install-options">
          <p>Para instalar no projeto atual:</p>
          <pre><code>guarana install --project</code></pre>
          <p>Confira a instalação:</p>
          <pre><code>guarana list<br />guarana plugin status</code></pre>
        </div>
      </div>
    </section>
  );
}

function Skills() {
  const core = [
    ['plan', 'Recupera o estado e define o próximo passo.'],
    ['build', 'Conduz o ciclo Frame → Run → Verify → Record.'],
    ['code', 'Implementa com leitura prévia e diff mínimo.'],
    ['verify', 'Valida a condição de aceitação de forma independente.'],
    ['research', 'Investiga evidências dentro de limites de leitura.'],
    ['remember / memory', 'Restaura contexto e consulta o grafo de memória.'],
  ];

  return (
    <section className="section skills-section" id="skills" aria-labelledby="skills-title">
      <div className="skills-intro">
        <p className="kicker">Procedimentos sob demanda</p>
        <h2 id="skills-title">Skills são o método,<br />não um prompt gigante.</h2>
        <p>O índice mantém metadados compactos. O corpo de uma skill relevante é carregado quando necessário; você também pode invocá-la explicitamente.</p>
        <a href={source('skills/guarana/SKILL.md')}>Ver a skill principal <span aria-hidden="true">↗</span></a>
      </div>
      <div className="skills-list">
        {core.map(([name, description]) => (
          <article className="skill-row" key={name}>
            <code>guarana:{name}</code>
            <p>{description}</p>
          </article>
        ))}
        <div className="skills-when">
          <h3>Quando necessário</h3>
          <p><code>debug</code> para falhas; <code>measure</code> para custos e limites; <code>skill-authoring</code> e <code>memory-maintenance</code> para manter conhecimento reutilizável.</p>
        </div>
      </div>
    </section>
  );
}

function Memory() {
  return (
    <section className="memory-section" id="memoria" aria-labelledby="memory-title">
      <div className="memory-copy">
        <p className="kicker">Memória com limites claros</p>
        <h2 id="memory-title">O que permanece<br />fica no seu disco.</h2>
        <p>Specs e estado de trabalho vivem em <code>.specs/</code>. O grafo de conhecimento do projeto fica em <code>.guarana/memory/</code>; preferências globais ficam no vault privado do usuário.</p>
        <p>Decisões, bugs, soluções e refactors são consultados sob demanda. Novas preferências usam as categorias <code>agent_behavior</code>, <code>workflow</code> ou <code>communication</code>; preferências confirmadas nessas categorias podem entrar automaticamente no contexto. Preferências Globais confirmadas legadas sem categoria armazenada continuam elegíveis como <code>general</code>, sem reescrita do vault; preferências de projeto sem categoria continuam excluídas. A injeção tem orçamento limitado. Desativar <code>memory.autoInject</code> desliga a injeção, mas não a busca explícita.</p>
        <a className="memory-link" href={source('docs/reference/memory.md')}>Entenda o modelo de memória <span aria-hidden="true">↗</span></a>
      </div>
      <div className="memory-map" aria-label="Separação entre arquivos de projeto e preferências privadas">
        <div className="map-row"><span>Projeto</span><code>.specs/</code><small>estado · specs · decisões</small></div>
        <div className="map-branch" aria-hidden="true">↳</div>
        <div className="map-row map-row-muted"><span>Conhecimento</span><code>.guarana/memory/</code><small>busca sob demanda</small></div>
        <div className="map-divider"><span>fronteira do projeto</span></div>
        <div className="map-row map-row-global"><span>Usuário</span><code>vault global</code><small>preferências privadas</small></div>
      </div>
    </section>
  );
}

function References() {
  return (
    <section className="references" aria-labelledby="references-title">
      <div>
        <p className="kicker">Fontes canônicas</p>
        <h2 id="references-title">Detalhes no repositório.</h2>
      </div>
      <ul>
        <li><a href={source('README.md')}>README <span aria-hidden="true">↗</span></a></li>
        <li><a href={source('docs/reference/orchestrator.md')}>Orquestração <span aria-hidden="true">↗</span></a></li>
        <li><a href={source('docs/reference/memory.md')}>Memória <span aria-hidden="true">↗</span></a></li>
        <li><a href={source('docs/reference/failure-modes.md')}>Falhas e recuperação <span aria-hidden="true">↗</span></a></li>
        <li><a href={source('CHANGELOG.md')}>Changelog <span aria-hidden="true">↗</span></a></li>
      </ul>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <a className="footer-wordmark" href="#inicio">guarana<span aria-hidden="true">.</span></a>
        <p>Engenharia em ciclo. Estado no disco.</p>
      </div>
      <div className="pages-note">
        <p>Publicação pelo GitHub Pages. Se ainda não estiver habilitada, a pessoa mantenedora precisa selecionar <strong>Settings → Pages → GitHub Actions</strong>.</p>
        <a href={repository}>Abrir repositório <span aria-hidden="true">↗</span></a>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <div className="page-shell">
        <Header />
        <main id="conteudo">
          <Hero />
          <ReleaseNote />
          <Workflow />
          <Capabilities />
          <Installation />
          <Skills />
          <Memory />
          <References />
        </main>
        <Footer />
      </div>
    </>
  );
}

function App() {
  const [isPortal, setIsPortal] = React.useState(
    () => window.location.hash.startsWith('#/docs') || window.location.hash.startsWith('#/examples'),
  );

  React.useEffect(() => {
    const updateRoute = () => setIsPortal(
      window.location.hash.startsWith('#/docs') || window.location.hash.startsWith('#/examples'),
    );
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  return isPortal ? <DocumentationSite /> : <LandingPage />;
}

createRoot(document.getElementById('root')).render(<App />);
