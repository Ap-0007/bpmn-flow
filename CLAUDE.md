# bpmn-flow — BPMN 2.0 → modelo normalizado → execução por tokens → viewer

Biblioteca modular: cada camada é um pacote independente e reutilizável em qualquer projeto.

## Stack

Monorepo npm workspaces · TypeScript (ESM) · tsup (build) · vitest · eslint + prettier.

## Comandos

```bash
npm run build      # todos os pacotes (tsup)
npm test           # vitest run (raiz)
npm run typecheck · npm run lint · npm run format
npm run dev        # playground
```

## Arquitetura

- `packages/core` — parser BPMN → modelo normalizado + motor de execução baseado em **tokens**.
- `packages/server` — API (validação de diagrama, salvar em `bpmn-files/`).
- `packages/viewer` — visualização interativa da execução no browser.
- `apps/playground` — editor/demo consumindo os pacotes.
- `docs/ARCHITECTURE.md`, `docs/BPMN-STANDARD.md`, `docs/BPMN-ICONS-OFFICIAL.md` — decisões e aderência ao padrão; consulte antes de mudar semântica de elemento BPMN.

## Convenções (não-negociáveis)

- **Aderência ao BPMN 2.0 é requisito**, não detalhe: semântica de gateway, evento e token segue a spec (`docs/BPMN-STANDARD.md`). Divergência precisa de justificativa escrita no doc.
- Dependência entre pacotes só pela API pública (`index.ts`); `core` não conhece server nem viewer, e não depende de DOM.
- Diagrama de teste vive em `bpmn-files/`; comportamento novo do motor entra com teste (vitest) que exercita o fluxo de tokens.
- Commits: Conventional Commits; mudança de contrato de pacote é `feat!`/`refactor!` com nota do impacto.
