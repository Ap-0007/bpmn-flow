# Aderência ao BPMN 2.0

Este documento registra como o `@bpmn-flow/core` implementa a semântica de
execução da especificação BPMN 2.0 (OMG) e onde ela é deliberadamente
simplificada. Toda divergência precisa estar listada aqui.

Referência de implementação: `packages/core/src/engine/engine.ts`.

## Modelo de execução

A execução é baseada em **tokens**, como na especificação: um token representa
uma linha de controle posicionada em um nó. O motor mantém uma fila de tokens
prontos e a processa até que todos concluam, falhem ou fiquem em espera.

Escopos aninhados representam o processo raiz e cada instância de subprocesso.
Um escopo termina quando não sobra nenhum token nele.

## Eventos

| Elemento                          | Comportamento implementado                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `startEvent`                      | Cria o token inicial do escopo e segue pelos fluxos de saída.                                       |
| `endEvent` (none)                 | Consome o token; o escopo conclui quando não há mais tokens.                                        |
| `endEvent` (terminate)            | Cancela **todos** os tokens do escopo imediatamente.                                                |
| `endEvent` (error)                | Consome o token e levanta o erro no escopo pai, procurando um evento de borda correspondente.       |
| `intermediateThrowEvent`          | Pass-through: conclui e segue adiante.                                                              |
| `intermediateCatchEvent`          | Estaciona o token (`waitReason: "catchEvent"`) até `signal()`.                                      |
| `boundaryEvent` interrompente     | Descarta o token da atividade hospedeira (ou o escopo do subprocesso) e segue pelo fluxo do evento. |
| `boundaryEvent` não interrompente | Mantém a atividade em execução e cria um token adicional no fluxo do evento.                        |

Definições de evento reconhecidas pelo parser: `message`, `timer`, `error`,
`signal`, `escalation`, `conditional`, `compensation`, `cancel`, `terminate` e
`link`. As que exigem gatilho externo são resolvidas por `signal()`.

## Atividades

- `userTask` e `receiveTask` **sem handler** param a execução
  (`waitReason: "userTask"` / `"receiveTask"`) e são retomadas com
  `completeTask()`.
- As demais tarefas sem handler são pass-through — a especificação não define o
  trabalho realizado, apenas o fluxo de controle.
- Com handler registrado, o retorno do handler é mesclado nas variáveis do
  processo. Lançar `BpmnError` procura um evento de borda de erro na atividade;
  sem correspondência, a execução falha.
- `subProcess`, `transaction` e `adHocSubProcess` criam um escopo filho e
  suspendem o token pai até a conclusão do escopo.
- `callActivity` **não instancia o processo chamado**: `calledElement` é lido
  para o modelo, mas a execução trata o elemento como uma tarefa comum (ver
  divergências).

## Gateways

### Exclusivo (XOR)

Avalia os fluxos de saída na ordem do documento e toma o **primeiro** cuja
condição é verdadeira, ignorando o fluxo default. Se nenhum casar, usa o
default. Sem default e sem condição verdadeira, a execução falha — conforme a
especificação, que trata isso como erro de modelagem.

### Paralelo (AND)

- **Divisão**: cria um token em cada fluxo de saída.
- **Junção**: contabiliza um token por fluxo de entrada e só prossegue quando
  todos chegaram, consumindo exatamente um de cada (o excedente permanece
  contabilizado para uma próxima rodada, como manda a semântica de instâncias
  múltiplas de um mesmo fluxo).

### Inclusivo (OR)

- **Divisão**: toma **todos** os fluxos cuja condição é verdadeira; se nenhum
  for, toma o default.
- **Junção**: os tokens ficam em buffer, e a junção dispara quando o motor
  atinge quiescência e **nenhum outro token do escopo consegue mais alcançar o
  nó de junção** (análise de alcançabilidade sobre o grafo). É a leitura da
  especificação que evita tanto deadlock quanto disparo prematuro; contar
  fluxos de entrada não funciona quando a divisão foi condicional.

### Baseado em evento

Arma todos os eventos-alvo dos fluxos de saída. O primeiro gatilho recebido
vence, e as alternativas são canceladas.

### Complexo

Sem semântica própria: comporta-se como inclusivo (ver divergências).

## Fluxos de sequência

Condições (`conditionExpression`) são avaliadas como JavaScript sobre as
variáveis do processo, com suporte ao invólucro `${ ... }`. Uma expressão que
lança ou não retorna `true` é tratada como falsa (fail-closed).

## Divergências assumidas

1. **Timers não são agendados.** `timeDuration`, `timeDate` e `timeCycle` são
   lidos para o modelo, mas o motor não tem relógio: o token fica em espera até
   `signal()`. Agendamento é responsabilidade de quem embute a biblioteca.
2. **Gateway complexo tratado como inclusivo.** A especificação delega o
   comportamento a uma expressão de ativação; a aproximação evita travar
   diagramas que usam o símbolo sem definir a expressão.
3. **Modo `auto`.** Fora da especificação, existe para simular execuções:
   resolve automaticamente qualquer espera e, quando um gateway não tem default
   nem condição verdadeira, toma o primeiro fluxo de saída. O modo `automation`
   (padrão) segue a especificação.
4. **Multi-instância e loop não são lidos.** `loopCharacteristics` é ignorado
   pelo parser, então uma atividade multi-instância executa uma única vez.
   Compensação é reconhecida como definição de evento, mas não tem semântica de
   execução.
5. **Call activity não é instanciada.** O elemento é reconhecido e o
   `calledElement` fica no modelo, mas nenhum escopo filho é criado; embutir o
   processo chamado como subprocesso é a alternativa hoje.
6. **Sinal não é difundido.** `signal(nameOrId)` resolve o primeiro alvo
   correspondente (evento de captura, alternativa de gateway baseado em evento
   ou evento de borda) e para por aí; a especificação difunde um sinal para
   todos os assinantes.
7. **Receive task só é retomada por `completeTask()`**, não por `signal()`.
8. **Event subprocess (`triggeredByEvent`) é reconhecido no modelo mas não
   executa**: não há gatilho que o inicie.
9. **Eventos de link** não são pareados: um throw de link encerra o ramo.
10. **Sem persistência ou transações.** O estado vive em memória; `transaction`
    se comporta como subprocesso comum, sem rollback.

## Layout e renderização

O modelo normalizado ignora a interchange de diagrama (DI). A renderização usa o
XML original; diagramas sem DI recebem posicionamento automático no viewer
(`bpmn-auto-layout`). O editor `bpmn-js` do playground, porém, exige DI.
