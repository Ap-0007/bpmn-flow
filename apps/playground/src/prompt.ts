/**
 * O diálogo que o modo passo a passo abre quando a execução para e precisa de
 * alguém: concluir uma tarefa, informar um valor, escolher um caminho.
 *
 * Ele só monta e devolve a resposta — quem sabe o que fazer com ela é o
 * main.ts, que fala com a engine.
 */

/** Um caminho oferecido ao operador. */
export interface PromptChoice {
  id: string;
  label: string;
  /** Condição do fluxo, mostrada como pista. */
  hint?: string;
  /** Valores que fazem a engine seguir por aqui. */
  assignments?: Record<string, unknown>;
}

/** Um valor que o processo vai ler adiante. */
export interface PromptField {
  name: string;
  /** Valor atual, já em texto. */
  value: string;
  /** Onde ele é usado. */
  hint?: string;
}

export interface StepRequest {
  title: string;
  /** Faixa/papéis da atividade. */
  badges: string[];
  /** Por que a execução parou aqui. */
  reason: string;
  choices: PromptChoice[];
  /** Id do caminho que as variáveis atuais já escolhem. */
  selected?: string;
  fields: PromptField[];
  confirmLabel: string;
}

export interface StepAnswer {
  action: 'confirm' | 'auto' | 'stop';
  choiceId?: string;
  values: Record<string, unknown>;
}

/** Texto do campo para valor: JSON quando dá, senão a string crua. */
function parseValue(raw: string): unknown {
  const text = raw.trim();
  // Campo em branco não vira variável: a execução segue com o que já tinha.
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Valor para dentro do campo: string sem aspas, o resto em JSON. */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  return JSON.stringify(value);
}

export class StepPrompt {
  private readonly dialog = document.createElement('dialog');
  private settle?: (answer: StepAnswer) => void;

  constructor() {
    this.dialog.className = 'step-dialog';
    // Esc fecha: para a condução em vez de deixar a promessa pendurada.
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.finish({ action: 'stop', values: {} });
    });
    document.body.append(this.dialog);
  }

  /** Abre o diálogo e resolve com o que o operador respondeu. */
  ask(request: StepRequest): Promise<StepAnswer> {
    this.dialog.replaceChildren(this.form(request));
    this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('.step-confirm')?.focus();
    return new Promise<StepAnswer>((resolve) => {
      this.settle = resolve;
    });
  }

  /** Fecha um diálogo aberto, respondendo como "parar". */
  close(): void {
    if (this.dialog.open) this.finish({ action: 'stop', values: {} });
  }

  private finish(answer: StepAnswer): void {
    const settle = this.settle;
    this.settle = undefined;
    if (this.dialog.open) this.dialog.close();
    settle?.(answer);
  }

  private form(request: StepRequest): HTMLFormElement {
    const form = document.createElement('form');
    form.method = 'dialog';

    const title = document.createElement('h2');
    title.textContent = request.title;
    form.append(title);

    const reason = document.createElement('p');
    reason.className = 'step-reason';
    reason.textContent = request.reason;
    form.append(reason);

    if (request.badges.length > 0) {
      const badges = document.createElement('p');
      badges.className = 'task-badges';
      for (const text of request.badges) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = text;
        badges.append(badge);
      }
      form.append(badges);
    }

    const inputs = new Map<string, HTMLInputElement>();
    if (request.fields.length > 0) form.append(this.fieldset(request.fields, inputs));
    if (request.choices.length > 0) form.append(this.choices(request, inputs));

    const footer = document.createElement('div');
    footer.className = 'step-footer';
    const values = (): Record<string, unknown> => {
      const collected: Record<string, unknown> = {};
      for (const [name, input] of inputs) {
        const value = parseValue(input.value);
        if (value !== undefined) collected[name] = value;
      }
      return collected;
    };
    const chosen = (): string | undefined =>
      form.querySelector<HTMLInputElement>('input[name="choice"]:checked')?.value;

    const confirm = document.createElement('button');
    confirm.type = 'submit';
    confirm.className = 'step-confirm';
    confirm.textContent = request.confirmLabel;
    confirm.addEventListener('click', () => {
      const answer: StepAnswer = { action: 'confirm', values: values() };
      const id = chosen();
      if (id !== undefined) answer.choiceId = id;
      this.finish(answer);
    });

    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'secondary';
    auto.textContent = 'Seguir sem perguntar';
    auto.title = 'Continua a execução respondendo por você até o fim';
    auto.addEventListener('click', () => {
      const answer: StepAnswer = { action: 'auto', values: values() };
      const id = chosen();
      if (id !== undefined) answer.choiceId = id;
      this.finish(answer);
    });

    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'secondary';
    stop.textContent = 'Parar';
    stop.addEventListener('click', () => this.finish({ action: 'stop', values: {} }));

    footer.append(confirm, auto, stop);
    form.append(footer);
    return form;
  }

  private fieldset(fields: PromptField[], inputs: Map<string, HTMLInputElement>): HTMLElement {
    const block = document.createElement('div');
    block.className = 'step-block';

    const legend = document.createElement('h3');
    legend.textContent = 'Valores';
    block.append(legend);

    for (const field of fields) {
      const row = document.createElement('label');
      row.className = 'step-field';

      const name = document.createElement('span');
      name.textContent = field.name;
      row.append(name);

      const input = document.createElement('input');
      input.type = 'text';
      input.value = field.value;
      input.spellcheck = false;
      if (field.hint) input.title = field.hint;
      inputs.set(field.name, input);
      row.append(input);

      block.append(row);
    }

    const note = document.createElement('p');
    note.className = 'step-note';
    note.textContent =
      'true, 42 e ["a"] entram como JSON; o resto entra como texto. Campo vazio não é enviado.';
    block.append(note);
    return block;
  }

  private choices(request: StepRequest, inputs: Map<string, HTMLInputElement>): HTMLElement {
    const block = document.createElement('div');
    block.className = 'step-block';

    const legend = document.createElement('h3');
    legend.textContent = 'Qual caminho seguir?';
    block.append(legend);

    for (const choice of request.choices) {
      const row = document.createElement('label');
      row.className = 'step-choice';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'choice';
      radio.value = choice.id;
      radio.checked = choice.id === request.selected;
      // Escolher o caminho preenche os valores que levam até ele.
      radio.addEventListener('change', () => {
        for (const [name, value] of Object.entries(choice.assignments ?? {})) {
          const input = inputs.get(name);
          if (input) input.value = formatValue(value);
        }
      });
      row.append(radio);

      const label = document.createElement('span');
      label.textContent = choice.label;
      row.append(label);

      if (choice.hint) {
        const hint = document.createElement('code');
        hint.textContent = choice.hint;
        row.append(hint);
      }
      block.append(row);
    }
    return block;
  }
}
