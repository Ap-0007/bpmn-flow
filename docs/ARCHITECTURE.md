# Arquitetura

Este documento descreve as decisoes de design do BPMN Flow.

## Objetivos

- Separar semantica (parsing e execucao) de apresentacao (renderizacao).
- Manter o nucleo isomorfico, executavel no backend e no frontend.
- Oferecer uma API pequena e previsivel, facil de embutir em qualquer projeto.

## Camadas

```
XML BPMN
   |  parseBpmn (bpmn-moddle)
   v
ProcessModel  ---- ProcessGraph (indices O(1))
   |  WorkflowEngine
   v
ExecutionSnapshot  ----> BpmnFlowViewer (bpmn-visualization)
                   ----> API REST (@bpmn-flow/server)
```

### Modelo (`@bpmn-flow/core/model`)

Estrutura de dados simples e serializavel. Cada elemento BPMN e mapeado para um
`FlowNode` tipado por `kind`, evitando que as camadas superiores toquem em nomes
de tipo do XML. A interchange de diagrama (posicoes, tamanhos) e omitida de
proposito: o viewer renderiza direto do XML original.

`ProcessGraph` indexa nos, fluxos e eventos de borda para acesso constante
durante a execucao.

### Parser (`@bpmn-flow/core/parser`)

Usa `bpmn-moddle` para ler o XML. O wiring de entrada/saida de cada no e
derivado dos proprios fluxos de sequencia, e nao dos arrays opcionais do no,
tornando o parsing robusto a diagramas inconsistentes. Subprocessos sao lidos
recursivamente como escopos aninhados.

### Motor (`@bpmn-flow/core/engine`)

Execucao por tokens. Um token representa uma linha de controle posicionada em um
no. O laco principal (`drain`) processa tokens prontos um a um; handlers podem
ser assincronos, e tarefas de usuario, eventos de captura e gateways baseados em
evento parametrizam estados de espera.

Decisoes por construcao:

- Gateway exclusivo: primeira condicao verdadeira, senao o fluxo default.
- Gateway paralelo: juncao conta um token por fluxo de entrada antes de seguir,
  depois divide em todas as saidas.
- Gateway inclusivo: a juncao dispara quando nenhum outro token do escopo ainda
  consegue alcancar o no de juncao (analise de alcancabilidade no grafo).
- Gateway baseado em evento: arma os eventos seguintes; o primeiro gatilho vence
  e cancela as alternativas.
- Subprocessos: criam um escopo filho e suspendem o token pai ate a conclusao;
  eventos de borda (interrompentes e nao) podem desviar o fluxo.
- Evento de fim terminate: cancela todos os tokens do escopo.

O modo `auto` resolve automaticamente qualquer estado de espera, util para
simular e animar uma execucao sem handlers ou gatilhos externos.

Avaliacao de condicoes: expressoes de fluxo sao parte de uma definicao confiavel
e sao avaliadas como JavaScript sobre as variaveis do processo. Uma expressao
que falha e tratada como `false` (fail-closed), de modo que um guard malformado
nunca derruba a execucao.

### Viewer (`@bpmn-flow/viewer`)

Envolve `bpmn-visualization`. Aplica o estado por `ExecutionSnapshot` (fonte de
verdade) e/ou anima incrementalmente via eventos do motor. Os ids dos elementos
do modelo coincidem com os ids no diagrama, entao o mapeamento e direto.

### Servidor (`@bpmn-flow/server`)

Aplicacao Hono. Mantem sessoes de execucao em memoria, cada uma com uma
instancia do motor, permitindo dirigir um processo passo a passo por HTTP. Serve
tambem exemplos `.bpmn` e assets estaticos com fallback de SPA.

## Limitacoes conhecidas

- Timers nao avancam sozinhos no modo automation; sao disparados via `signal`
  (ou resolvidos no modo auto).
- Call activities so executam quando o processo referenciado esta disponivel no
  proprio modelo; caso contrario, comportam-se como pass-through.
- A juncao inclusiva usa alcancabilidade estrutural, adequada para modelos bem
  formados; topologias muito irregulares podem exigir revisao.
