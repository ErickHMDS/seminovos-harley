# Servopa Seminovos

App interno do **Grupo Servopa Seminovos Motos**.

Aplicativo web (celular e computador) para controle de **vendas, preparação e estoque de seminovos**.
A base de dados continua sendo o Google Sheets: **tudo o que é feito no app vai para a planilha e o que é editado na planilha aparece no app** (em até 60 s, ou na hora pelo botão de atualizar ⟳).

## Áreas

| Área | Quem acessa | O que faz |
|---|---|---|
| **Painel (Gestor)** | Gestor | Vendas × meta, histórico, idade do estoque, margem, motos paradas, vendas a faturar, preparação e atividades abertas. |
| **Ranking** | Gestor | Ranking por vendedor (mês/ano, loja). **Lançar, editar e excluir vendas.** |
| **Preparação** | Gestor e Preparador editam; Vendedor vê | Quadro com 4 etapas e busca. Na etapa de fotos, envio/importação das fotos para a pasta da moto no Drive. O gestor pode **excluir uma preparação** (a moto continua no estoque). Moto antiga do estoque sem preparação: botão **Criar preparação** (já vem com os dados do estoque, na etapa final, para completar o 360 e as fotos). **Checklist 360 (OK/Pendente)**, e-mail pronto para os coordenadores ao concluir a inspeção. |
| **Estoque** | Todos (custo/margem e edição só Gestor) | Busca e filtros. **Gestor adiciona, edita e remove motos.** |
| **Atividades** | Gestor | Pendências da inspeção 360 viram atividades; o gestor resolve (com nota) ou cria tarefas avulsas. |
| **Catálogo** | Gestor | Marcas e modelos (tipo, cilindrada, anos, apelidos) e **segmentos de equivalência** entre marcas. Base do autocompletar e dos leads. |
| **Minha meta** | Vendedor (gestor vê de todos) | Tela inicial do vendedor: **Lançar venda, Lançar lead e Lançar atividade** e tabela com as vendas dele no mês. Anel da meta, ritmo por dia de loja, projeção, distância no ranking, FIN/G.E/usado × equipe, histórico e plano do dia. |
| **Atividades** | Todos (cada um vê as suas; gestor vê todas e filtra por pessoa) | Visões **Lista** (por dia; atrasadas no topo; dia concluído recolhe) e **Kanban** (Atrasadas · A fazer · Em andamento · Finalizado, arrastar entre colunas). Data e hora, prioridade Normal/Urgente, pessoas marcadas, observação e repetição (diária, semanal, quinzenal, mensal: ao finalizar cria a próxima). |
| **Tarefas / Atividades (antigo)** | Vendedor: as próprias atividades (rotina, ligadas a uma moto ou a um lead — aparecem na ficha da moto e no lead) + leads sem Syonet. Gestor: cobrança por vendedor (uma linha, prioridade pela quantidade; "Cobrei" esconde por 24 h) + pendências da 360 | |
| **Leads** | Vendedor (só os seus), Gestor (todos) | Cliente + moto desejada. Oportunidades quando entra no estoque/preparação a moto exata ou equivalente; ligar, WhatsApp com mensagem pronta, registrar contato, retornos do dia. |
| **Cadastro** | Gestor | Equipe com senha individual (vendedor, preparador, gestor), redefinir senha/desativar, vínculo com o vendedor da planilha, e-mails dos coordenadores. |

## Como o app grava nas planilhas

- **Vendas (MOTOS 2026):** cada venda vai para a **primeira linha livre da aba do mês**, preenchendo só as colunas de digitação (Data … Observações). As fórmulas das colunas O–S (usadas pelo PAINEL GERAL) **não são tocadas**. Se o mês ainda não tem aba (ex.: dezembro), o app **duplica a aba do mês anterior** (com fórmulas e formatação) e limpa os lançamentos.
  - Contam como venda, igual ao PAINEL GERAL: **FATURADO, ESTOQUE (vendida, aguardando faturar) e TRANSFERENCIA**. "CANCELADA" fica registrada mas não conta.
  - O PAINEL GERAL aponta para a aba do mês nas fórmulas; ao virar o mês, atualize as referências dele como já fazia.
- **Estoque:** edição altera só as células modificadas; a coluna **Dias Estoque (`=TODAY()-G`) nunca é sobrescrita**. Moto nova recebe a fórmula copiada da linha de cima (se a aba estiver cheia, o app insere uma linha). "Remover do estoque" apaga a linha após confirmação.
- **Receber moto (preparador):** marca/modelo com sugestões do catálogo (se o modelo escolhido é de outra marca, a marca é corrigida). Ao concluir a inspeção 360 a moto **entra no estoque** da loja escolhida com status EM PREPARAÇÃO (colunas "Marca" e "Tipo" são acrescentadas à direita da aba de estoque). Ao finalizar a preparação já postada nas redes, o status vira ANUNCIADO.
- **Catálogo Motos:** começa com uma base de ~545 modelos vendidos no Brasil (pesquisa; anos aproximados). Ao salvar, vira a aba "Catálogo Motos" na planilha de estoque, editável pelo app ou direto na planilha. Equivalência = mesmo segmento (tipo + faixa de cilindrada), que o gestor pode ajustar manualmente.
- **Motos em Preparação:** mantém as 9 colunas originais e acrescenta à direita as colunas do app (etapa, checklist 360, datas, fotos…).
- **Atividades:** aba criada pelo app na planilha de estoque.
- Antes de editar/excluir, o app confere se a linha ainda é a mesma (placa/vendedor/veículo); se alguém mexeu na planilha no meio do caminho, ele avisa em vez de gravar no lugar errado.

## Acesso

- Cada pessoa tem **senha individual**, criada pelo gestor em **Cadastro** (aba "Usuários App"; a senha fica só em hash).
- `SENHA_GESTOR` (servidor) é a **senha mestra** do administrador e sempre funciona.
- `SENHA_VENDEDOR` / `SENHA_PREPARADOR` (genéricas) só valem enquanto não houver ninguém cadastrado naquele perfil.
- Redefinir a senha, mudar o perfil ou desativar derruba as sessões abertas da pessoa.

## Planilhas

- **MOTOS 2026** (`SHEET_VENDAS_ID`): vendas.
- **Estoque Motos / Realinhamento** (`SHEET_ESTOQUE_ID`): `Estoque CTBA` e `Estoque LOND` (+ colunas Marca/Tipo).
- **Servopa Seminovos - App** (`SHEET_APP_ID`): dados do app — `Motos em Preparação`, `Usuários App`, `Configurações App`, `Leads`, `Atividades`, `Cobranças`, `Catálogo Motos`, `Fotos`, `Backup Ajustes App`.

## Fotos das motos

- **Google Drive (recomendado):** pasta "Fotos Motos" no **Drive compartilhado "APP SEMI NOVOS"** (conta de serviço como membro com edição) e informada em **Cadastro → Fotos no Google Drive**. O app **cria sozinho a subpasta de cada moto** (`PLACA - MODELO`) quando ela é recebida na preparação ou cadastrada no estoque; o botão "Criar pastas das motos do estoque" cria as que faltam. O preparador sobe as fotos na pasta (pelo app do Drive no celular) e, na ficha da moto, **Importar do Google Drive** traz as imagens (sem duplicar). O app lê com a conta de serviço e entrega reduzido (`/api/drive/<id>`), sem deixar nada público.
- **Enviar fotos pelo app** (preparação na etapa de fotos ou ficha da moto): a foto, já reduzida no navegador, vai **direto para a pasta da moto no Drive**. Como o Google não deixa a conta de serviço guardar arquivos numa pasta comum, isso funciona de um destes jeitos: (a) a pasta está num **Drive compartilhado** com a conta do app como Gerente de conteúdo (configuração atual), ou (b) a **ponte do Google Apps Script** (Cadastro → Fotos no Google Drive → Enviar fotos pelo app: código pronto, 5 passos, testado ao salvar), que grava usando o espaço da conta dona da pasta. Remover no app uma foto enviada pelo app a manda para a lixeira do Drive (recuperável por 30 dias); fotos importadas de uma pasta continuam no Drive. Sem Drive configurado, o envio usa o Vercel Blob (`BLOB_READ_WRITE_TOKEN`), se existir.
- **Ordem das fotos:** miniaturas numeradas (Capa, 2, 3…); arraste para reordenar (no celular, setas; ★ torna capa). A ordem fica na coluna "Ordem" da aba `Fotos`.
- Os endereços ficam na aba `Fotos` da planilha do app. Também é possível adicionar foto por link.

## Desempenho

- Os dados das planilhas ficam em cache no servidor: até 60 s servem direto; depois disso (até 10 min) a tela abre na hora com o que já tem e a atualização é buscada em segundo plano. Gravações pelo app e o botão ⟳ Atualizar limpam o cache na hora.
- Ao abrir qualquer tela, o app já carrega em segundo plano os dados das outras abas, e o navegador pré-carrega as abas do menu (guardadas por 30 s).

## Configuração

1. Conta de serviço do Google com a **Google Sheets API** e a **Google Drive API** ativas; compartilhe as duas planilhas com o e-mail dela como **Editor**.
2. Variáveis (veja `.env.example`): `GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_VENDAS_ID`, `SHEET_ESTOQUE_ID`, `ESTOQUE_ABAS`, `PREPARACAO_ABA`, `APP_SECRET`, `SENHA_GESTOR`, `SENHA_VENDEDOR`, `SENHA_PREPARADOR`, `COORDENADOR_EMAIL` (vários separados por vírgula).

> Nunca versione o JSON da conta de serviço nem o `.env.local`.

## Rodando

```bash
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # produção
```

Publicado na Vercel a partir da branch `main` (o `vercel.json` fixa o framework Next.js).
