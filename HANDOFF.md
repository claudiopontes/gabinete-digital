# HANDOFF - Varadouro Digital Aquiry

## 1) Resumo do Projeto
- Nome: Varadouro Digital Aquiry
- Objetivo principal:
  - Entregar paineis de transparencia e analise para apoio a decisao, com foco inicial em combustivel (NFe) e visualizacao territorial do Acre.
- Publico-alvo:
  - Equipe de gabinete/analistas e gestao publica que consultam indicadores e recortes por municipio, entidade e periodo.

## 2) Stack e Ambiente
- Frontend:
  - Next.js 16 (App Router) + React 19 + TypeScript + Tailwind.
- UI base:
  - Template TailAdmin, com rotas customizadas no grupo `(admin)`.
- Backend/Servicos:
  - Supabase (consumo no frontend e destino das tabelas agregadas).
  - ETL Node/TypeScript em `etl/` para carga de fatos e dimensoes.
  - Fonte de dados operacional: SQL Server (no ETL).
- Variaveis de ambiente essenciais:
  - Frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - ETL: `SUPABASE_SERVICE_ROLE_KEY`, `SQLSERVER_*`, `DIM_*_CSV`, `ETL_TIMEZONE`, `FACT_ETL_CRON`.
- Como rodar:
  - Frontend: `npm install` e `npm run dev`.
  - ETL: na pasta `etl`, `npm install`, depois `npm run combustivel`, `npm run dimensoes` ou `npm run agendar`.

## 3) Decisoes Tecnicas (Fonte de Verdade)
- Uso de Supabase no frontend somente com chave anonima publica; service role fica restrita ao ETL.
- ETL de combustivel faz substituicao total das tabelas agregadas em cada execucao (estrategia simples e previsivel).
- Frontend de combustivel possui fallback para schema legado sem coluna `emitente`.
- Componentes de mapa (Leaflet) e mapas dinâmicos rodam client-side (`ssr: false`) para evitar conflitos de SSR.

## 4) Estrutura Importante
- Rotas principais:
  - `src/app/(admin)/painel-combustivel/page.tsx`
  - `src/app/(admin)/gabinete-digital/mapa/page.tsx`
  - `src/app/(admin)/gabinete-digital/seletor-municipio/page.tsx`
- Componentes criticos:
  - `src/components/combustivel/PainelCombustivelClient.tsx`
  - `src/components/combustivel/CombustivelHeaderFilters.tsx`
  - `src/components/Maps/SeletorMunicipio.tsx`
  - `src/layout/AppHeader.tsx` e `src/layout/AppSidebar.tsx`
- Infra/dados:
  - `src/lib/supabase.ts`
  - `etl/jobs/combustivel.ts`
  - `etl/jobs/dimensoes-csv.ts`
  - `etl/schedule.ts`
  - `etl/schema/*.sql`

## 5) Estado Atual
- Ultima atualizacao: 2026-04-16
- O que ja foi concluido:
  - Rotas de menu para Combustivel, IDEB Acre (mapa) e Seletor de Municipio estao ativas.
  - Painel de combustivel com filtros via query string (municipio, entidade, tipo, emitente).
  - Carregamento de dados no painel com protecao para Supabase nao configurado.
  - ETL com job de combustivel, job de dimensoes por CSV e scheduler diario.
- O que esta em andamento:
  - Organizacao de handoff e backlog para continuidade sem perda de contexto.
- O que esta bloqueado:
  - Sem bloqueio tecnico confirmado no codigo.
  - Dependencia externa: credenciais e ambiente de dados (Supabase/SQL Server) para validacao completa em producao.

## 6) Proxima Tarefa Prioritaria
- Tarefa:
  - Validar fluxo ponta a ponta de dados (ETL -> Supabase -> painel) em ambiente real e registrar baseline de operacao.
- Criterio de pronto:
  - ETL executa sem erro.
  - Tabelas `combustivel_*` e `aux_dim_*` atualizadas no Supabase.
  - Painel abre sem mensagem de configuracao ausente e filtros retornam dados consistentes.
  - Registro de evidencias (query/tela/log) anexado no handoff.
- Riscos/atencao:
  - Divergencia de schema (ex.: coluna `emitente` ausente em algum ambiente).
  - Permissoes/RLS no Supabase impactando leitura no frontend.
  - Qualidade dos CSVs de dimensoes (header e encoding) impactando relacionamento por codigo.

## 7) Pendencias de Produto e Tecnica
- Produto:
  - Definir backlog funcional do modulo `gabinete-digital/mapa` (atualmente pagina base com `MapaAcre`).
  - Definir KPIs oficiais e filtros obrigatorios para versao 1.
- Tecnica:
  - Padronizar encoding de textos com acento para evitar exibicao inconsistente em alguns terminais.
  - Criar checklist de publicacao (env, ETL, smoke test).
- Divida tecnica:
  - Alguns componentes possuem alta complexidade e merecem modularizacao incremental (especialmente filtros/dialogos do combustivel).

## 8) Instrucao para Retomar no Proximo Chat
Use esta frase no inicio da proxima conversa:

`Continue o projeto Varadouro Digital Aquiry lendo HANDOFF.md e TODO.md. Foque no P0, execute e atualize os dois arquivos ao final da sessao.`
