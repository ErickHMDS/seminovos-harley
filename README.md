# Seminovos Harley

Aplicativo web (funciona no celular e no computador) para controle de **vendas, preparação e estoque de seminovos**, usando as planilhas do Google Sheets como base de dados.

## Áreas

| Área | Quem acessa | O que faz |
|---|---|---|
| **Gestor** | Gestor | Visão geral: vendas do mês × meta, histórico de 12 meses, idade do estoque, margem potencial, motos mais paradas, vendas em andamento e pendências da preparação. |
| **Ranking** | Gestor, Vendedor | Ranking por vendedor (mês ou ano), meta da aba PAINEL GERAL, faturadas/em andamento, FIN, G.E, usado, seguro, filtro por loja. |
| **Preparação** | Gestor e Preparador editam; Vendedor só vê | Quadro com 4 etapas: recepção e inspeção 360 → fornecedor → retorno e fotos oficiais → finalizada. Gera o e-mail para o coordenador. |
| **Estoque** | Todos (custo e margem só para o Gestor) | Estoque de Curitiba e Londrina com busca e filtros por cidade, marca, status e tempo parado. |
| **Leads** | — | Em breve. |

## Planilhas usadas

- **MOTOS 2026** (`SHEET_VENDAS_ID`): uma aba por mês. O app descobre o mês de cada aba **pelas datas lançadas**, não pelo nome. Se duas abas caem no mesmo mês, usa a que tem mais vendas. As metas vêm da aba `PAINEL GERAL` (colunas OBJETIVO/VENDEDOR).
- **Estoque Motos / Realinhamento** (`SHEET_ESTOQUE_ID`): abas `Estoque CTBA` e `Estoque LOND` (somente leitura) e `Motos em Preparação` (o app grava aqui).

### O que o app grava

O app **só grava** na aba `Motos em Preparação`. Na primeira moto registrada, ele acrescenta colunas à direita das 9 colunas que já existem (ID App, Etapa, Loja, Ano, Km, Data Recepção, Responsável, Riscos/Arranhões, Sujeira, Detalhes Estéticos, Manual, Chave Reserva, Última Revisão, E-mail Coordenador, Foto Em Preparação Postada, Data Retorno, Qtd Fotos Oficiais, Postado nas Redes, Data Finalização, Atualizado Em).

Ao editar, ele altera apenas as células que mudaram. Motos lançadas direto na planilha também aparecem no quadro, com a etapa deduzida pelo que está preenchido.

## Configuração

1. Crie uma conta de serviço no Google Cloud, ative a **Google Sheets API** e baixe a chave JSON.
2. Compartilhe as duas planilhas com o e-mail da conta de serviço como **Editor**.
3. Copie `.env.example` para `.env.local` e preencha:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: conteúdo do JSON (ou `GOOGLE_SERVICE_ACCOUNT_FILE` com o caminho do arquivo).
   - `APP_SECRET`: texto aleatório longo (`openssl rand -hex 32`).
   - `SENHA_GESTOR`, `SENHA_VENDEDOR`, `SENHA_PREPARADOR`: senhas de cada perfil.
   - `COORDENADOR_EMAIL`: destinatário do e-mail de envio ao fornecedor.

> Nunca versione o JSON da conta de serviço nem o `.env.local` (já estão no `.gitignore`).

## Rodando

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:3000
npm run build && npm start   # produção
```

## Publicação

Funciona em qualquer hospedagem Node (por exemplo, Vercel). Configure as mesmas variáveis de ambiente no painel da hospedagem. Os dados lidos ficam em cache por 60 segundos (`CACHE_SEGUNDOS`) para respeitar a cota da API do Google.
