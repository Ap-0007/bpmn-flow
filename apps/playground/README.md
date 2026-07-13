# @bpmn-flow/playground

Aplicacao interativa para carregar, visualizar e executar processos BPMN no
navegador. Combina `@bpmn-flow/core` (execucao) e `@bpmn-flow/viewer`
(renderizacao). Os arquivos de exemplo em `bpmn-files/` sao embutidos no build.

## Desenvolvimento

Na raiz do repositorio:

```bash
npm install
npm run build            # compila core e viewer (dependencias)
npm run dev              # sobe o playground em http://localhost:5173
```

## Build e publicacao numa porta

```bash
npm run build --workspace @bpmn-flow/playground
node packages/server/dist/bin.js --static apps/playground/dist --samples bpmn-files --port 3000
```

## Como usar a interface

- Selecione um exemplo ou use "Carregar arquivo" para abrir um `.bpmn` proprio.
- "Iniciar" executa em modo automation: a execucao pausa em tarefas de usuario e
  eventos de captura, exibindo botoes para concluir ou sinalizar.
- "Executar tudo" roda em modo auto ate o fim.
- Informe variaveis em JSON para influenciar os gateways condicionais.
- O painel mostra status, variaveis e o historico da execucao; o diagrama
  destaca nos concluidos, tokens ativos, atividades em espera e fluxos
  percorridos.
