# Handoff - Painel de Combustivel

## Estado atual
- Branch: `main`
- Ultimo commit: `9d19f8b`
- Repositorio sincronizado com `origin/main`
- Frontend do painel de combustivel criado e estilizado em padrao TailAdmin
- Layout mais compacto (filtros superiores + graficos + KPIs) implementado

## Arquivos principais envolvidos
- `src/components/combustivel/PainelCombustivelClient.tsx`
- `src/app/(admin)/painel-combustivel/page.tsx`
- `src/layout/AppSidebar.tsx`
- `etl/jobs/combustivel.ts`
- `etl/jobs/dimensoes-csv.ts`
- `etl/schema/dimensoes_auxiliares.sql`

## Decisoes importantes ja tomadas
- Dimensoes auxiliares via CSV no Supabase:
  - `aux_dim_uf`
  - `aux_dim_municipio`
  - `aux_dim_ente`
  - `aux_dim_entidade`
- Normalizacao de chaves para digitos (string numerica)
- ETL de combustivel ajustado para total correto:
  - usar `SUM(VALOR * QUANTIDADE)` (nao somar preco unitario)
- Frontend passou a buscar `combustivel_mensal` com paginacao (nao limitar 1000 linhas)

## Situacao de dados (referencia)
- Carga de dimensoes concluida em execucoes anteriores
- KPIs ficaram proximos do PowerBI apos correcao do ETL

## Como retomar no outro equipamento
1. Clonar repositorio e instalar dependencias (`npm install` e `etl/npm install`)
2. Copiar `.env` e `.env.local` com credenciais
3. Rodar:
   - `npm run lint`
   - `npm run dev`
4. Acessar rota: `/painel-combustivel`

## Prompt recomendado para continuar com o Codex
Use este texto no primeiro prompt da nova sessao:

```txt
Continue a partir do arquivo HANDOFF_COMBUSTIVEL.md deste repositorio.
Estamos no painel de combustivel (TailAdmin), com layout compacto.
Quero validar fidelidade visual com o modelo PowerBI e ajustar os detalhes finais de espacamento/legibilidade, sem perder o padrao da pagina principal.
Antes de alterar, leia os arquivos citados no handoff e me mostre um plano curto.
```

## Proximos passos sugeridos
- Ajuste fino de densidade visual (altura de cards e graficos)
- Ajuste de legenda e rotulos dos graficos para ficar mais proximo do PowerBI
- Validacao final com dados reais e filtros combinados
