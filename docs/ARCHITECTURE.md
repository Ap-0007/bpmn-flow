# Arquitetura

Este documento descreve as decisões de design do BPMN Flow.

## Objetivos

- Separar semântica (parsing e execução) de apresentação (renderização).
- Manter o núcleo isomórfico, executável no backend e no frontend.
- Oferecer uma API pequena e previsível, fácil de embutir em qualquer projeto.

## Camadas

```
XML BPMN
   |  parseBpmn (bpmn-moddle)
   v
ProcessModel  ---- ProcessGraph (índices O(1))
   |  WorkflowEngine
   v
ExecutionSnapshot  ----> BpmnFlowViewer (bpmn-visualization)
                   ----> API REST (@bpmn-flow/server)
```

### Modelo (`@bpmn-flow/core/model`)

Estrutura de dados simples e serializável. Cada elemento BPMN é mapeado para um
`FlowNode` tipado por `kind`, evitando que as camadas superiores toquem em nomes
de tipo do XML. A interchange de diagrama (posições, tamanhos) é omitida de
propósito: o viewer renderiza direto do XML original.

`ProcessGraph` indexa nós, fluxos e eventos de borda para acesso constante
durante a execução.

### Parser (`@bpmn-flow/core/parser`)

Usa `bpmn-moddle` para ler o XML. O wiring de entrada/saída de cada nó é
derivado dos próprios fluxos de sequência, e não dos arrays opcionais do nó,
tornando o parsing robusto a diagramas inconsistentes. Subprocessos são lidos
recursivamente como escopos aninhados.

### Motor (`@bpmn-flow/core/engine`)

Execução por tokens. Um token representa uma linha de controle posicionada em um
nó. O laço principal (`drain`) processa tokens prontos um a um; handlers podem
ser assíncronos, e tarefas de usuário, eventos de captura e gateways baseados em
evento parametrizam estados de espera.

Decisões por construção:

- Gateway exclusivo: primeira condição verdadeira, senão o fluxo default.
- Gateway paralelo: junção conta um token por fluxo de entrada antes de seguir,
  depois divide em todas as saídas.
- Gateway inclusivo: a junção dispara quando nenhum outro token do escopo ainda
  consegue alcançar o nó de junção (análise de alcançabilidade no grafo).
- Gateway baseado em evento: arma os eventos seguintes; o primeiro gatilho vence
  e cancela as alternativas.
- Subprocessos: criam um escopo filho e suspendem o token pai até a conclusão;
  eventos de borda (interrompentes e não) podem desviar o fluxo.
- Evento de fim terminate: cancela todos os tokens do escopo.

O modo `auto` resolve automaticamente qualquer estado de espera, útil para
simular e animar uma execução sem handlers ou gatilhos externos.

Avaliação de condições: expressões de fluxo são parte de uma definição confiável
e são avaliadas como JavaScript sobre as variáveis do processo. Uma expressão
que falha é tratada como `false` (fail-closed), de modo que um guard malformado
nunca derruba a execução.

### Viewer (`@bpmn-flow/viewer`)

Envolve `bpmn-visualization`. Aplica o estado por `ExecutionSnapshot` (fonte de
verdade) e/ou anima incrementalmente via eventos do motor. Os ids dos elementos
do modelo coincidem com os ids no diagrama, então o mapeamento é direto.
Diagramas sem interchange de diagrama (DI) são posicionados com
`bpmn-auto-layout` antes da renderização.

### Servidor (`@bpmn-flow/server`)

Aplicação Hono. Mantém sessões de execução em memória, cada uma com uma
instância do motor, permitindo dirigir um processo passo a passo por HTTP. Serve
também exemplos `.bpmn` e assets estáticos com fallback de SPA.

## Limitações conhecidas

- Timers não avançam sozinhos no modo automation; são disparados via `signal`
  (ou resolvidos no modo auto). Não há agendador.
- Call activities só executam quando o processo referenciado está disponível no
  próprio modelo; caso contrário, comportam-se como pass-through.
- A junção inclusiva usa alcançabilidade estrutural, adequada para modelos bem
  formados; topologias muito irregulares podem exigir revisão.
- Uma expressão de condição que referencia uma variável inexistente resolve para
  `false`, e não para `undefined` por identificador: o `try/catch` envolve a
  expressão inteira.
- O editor do playground (`bpmn-js`) exige DI no XML. Diagramas sem layout
  abrem no viewer (auto-layout), mas não no editor.
