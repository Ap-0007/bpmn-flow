# @bpmn-flow/playground

Aplicação interativa para carregar, visualizar e executar processos BPMN no
navegador. Combina `@bpmn-flow/core` (execução) e `@bpmn-flow/viewer`
(renderização). Os arquivos de exemplo em `bpmn-files/` são embutidos no build.

## Desenvolvimento

Na raiz do repositório:

```bash
npm install
npm run build            # compila core e viewer (dependências)
npm run dev              # sobe o playground em http://localhost:5173
```

## Build e publicação numa porta

```bash
npm run build --workspace @bpmn-flow/playground
node packages/server/dist/bin.js --static apps/playground/dist --samples bpmn-files --port 3000
```

## Como usar a interface

Há dois modos, alternados pelos botões "Executar" e "Editar".

### Executar

- Selecione um exemplo ou use "Carregar arquivo" para abrir um `.bpmn` próprio.
- "Iniciar" executa em modo automation: a execução pausa em tarefas de usuário e
  eventos de captura, exibindo botões para concluir ou sinalizar.
- "Executar tudo" roda em modo auto até o fim.
- Informe variáveis em JSON para influenciar os gateways condicionais. No
  `processo-compras`, `{ "valor": 2500, "aprovado": false }` leva à rejeição e
  `{ "valor": 500, "aprovado": true }` pula a aprovação gerencial.
- O painel de **ações pendentes** mostra um cartão por tarefa, com a raia, os
  papéis (`potentialOwner`) e — numa atividade multi-instância — o item daquela
  instância.
- O painel de **timers** lista os prazos pendentes; "Adiantar relógio" força o
  vencimento do próximo, útil para demonstrar um SLA sem esperar.
- O painel mostra status, variáveis e o histórico da execução; o diagrama
  destaca nós concluídos, tokens ativos, atividades em espera e fluxos
  percorridos.
- "Reprisar" refaz a execução passo a passo a partir do histórico; "Métricas"
  liga etiquetas de tempo médio em cada atividade.
- Diagramas sem layout são posicionados automaticamente; use "Ajustar" para
  enquadrar e o mouse para navegar (arrastar) e dar zoom (roda).

### Editar

- Cria e edita diagramas com o editor `bpmn-js` (paleta à esquerda).
- "Novo" começa um diagrama em branco; "Abrir arquivo" carrega um `.bpmn`.
- "Validar" verifica a estrutura BPMN com o `@bpmn-flow/core` e lista erros e
  avisos.
- "Salvar no repositório" valida e grava o `.bpmn` no diretório de exemplos do
  servidor (`--samples`). A gravação exige o `@bpmn-flow/server` em execução.
  Nomes aceitam apenas letras, números, hífen e sublinhado.

Limitações conhecidas do modo editar: o `bpmn-js` exige interchange de diagrama
(DI), então diagramas sem layout — como `processo-gestao-projeto.bpmn` — não
abrem no editor, e o editor mantém em memória o primeiro diagrama aberto na
sessão.
