import { EditorState, Extension, Prec, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
  placeholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands';
import {
  CompletionContext,
  CompletionResult,
  autocompletion,
  completionKeymap,
  completionStatus,
  startCompletion,
} from '@codemirror/autocomplete';
import { JqlAutocompleteService } from './jql-autocomplete.service';

/**
 * The JQL field. Text and colours live in one element, which is what a transparent textarea
 * over a coloured copy of itself could not manage — the two drifted apart as the query grew.
 * The JQL knowledge is all JqlAutocompleteService's.
 */

// Styled here, not in the component's stylesheet: CodeMirror builds its DOM at runtime, which
// Angular's style encapsulation never marks.
const jqlTheme = EditorView.theme({
  '&': {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: '0.875rem',
    color: 'var(--ds-text, #172b4d)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': { outline: 'none' },
  // No chrome: the host element carries the app's field styling.
  '.cm-content': { padding: '0', caretColor: 'var(--ds-text, #172b4d)' },
  '.cm-line': { padding: '0' },
  // 1.9 because lozenges are taller than the text; at 1.5 wrapped rows nearly touched.
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.9' },
  '.cm-placeholder': { color: 'var(--ds-text-subtlest, #626f86)' },
  '.jql-field': { color: 'var(--ds-text-accent-blue, #0c66e4)' },
  '.jql-operator': { color: 'var(--ds-text-accent-teal, #206a83)' },
  '.jql-keyword': { color: 'var(--ds-text-accent-purple, #5e4db2)' },
  '.jql-error': { color: 'var(--ds-text-accent-red, #ae2e24)', textDecoration: 'underline wavy' },
  '.jql-user': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 6px 0 2px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-background-neutral, #f1f2f4)',
    color: 'var(--ds-text, #172b4d)',
    fontFamily: 'var(--ds-font-family-body, inherit)',
    lineHeight: '1.2',
    // middle, not baseline: an inline-flex box takes its baseline from its first item, the
    // avatar, which left the whole lozenge riding above the line.
    verticalAlign: 'middle',
  },
  '.jql-user-avatar': { display: 'block', width: '16px', height: '16px', borderRadius: '50%' },
  // Full line height + object-fit: Jira's icons carry different internal padding, so no single
  // baseline offset suits them all. Height must equal .cm-scroller's line-height.
  '.jql-value-icon': {
    width: '14px',
    height: '1.9em',
    objectFit: 'contain',
    verticalAlign: 'top',
    marginRight: '4px',
  },
  // Doubled class on every popup rule: CM's base theme uses `.cm-tooltip.cm-tooltip-autocomplete`,
  // and a single-class selector loses to it on specificity — silently keeping CM's own sizing.
  '.cm-tooltip.cm-tooltip-autocomplete': {
    // Stands clear of the field, and off the error line underneath it.
    marginTop: '0.5rem',
    border: '1px solid var(--ds-border, #dfe1e6)',
    borderRadius: '3px',
    boxShadow: '0 4px 8px rgba(9, 30, 66, 0.15)',
    backgroundColor: 'var(--ds-surface-overlay, #fff)',
  },
  // Field names and quoted values are long; CM's 250px default cut them off mid-name.
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    minWidth: '30rem',
    maxWidth: '90vw',
    maxHeight: '22rem',
    padding: '4px 0',
    fontFamily: 'inherit',
  },
  // As Jira's: the label is the whole row, no detail column and no icons.
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '10px 16px',
    lineHeight: '1.4',
    color: 'var(--ds-text, #172b4d)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li:hover': {
    backgroundColor: 'var(--ds-background-neutral-subtle-hovered, #f1f2f4)',
  },
  // Neutral tint, as Jira uses. background.selected must pair with text.selected if ever used:
  // it is a light tint, so text.inverse on it is white on near-white.
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--ds-background-neutral-subtle-hovered, #f1f2f4)',
    color: 'var(--ds-text, #172b4d)',
  },
  '.cm-completionIcon': { display: 'none' },
});

const jqlHighlighting = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      // Unconditionally: the empty transaction dispatched when the engine lands paints first.
      this.decorations = this.build(update.view);
    }

    private build(view: EditorView): DecorationSet {
      const text = view.state.doc.toString();
      const spans = JqlAutocompleteService.highlightSync(text);
      if (!spans) {
        return Decoration.none;
      }
      return Decoration.set(
        spans
          .filter((span) => span.cls && span.to > span.from)
          .map((span) => Decoration.mark({ class: span.cls }).range(span.from, span.to))
      );
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

// The three account-id shapes in use: classic 24-char, `557058:<uuid>`, `qm:<uuid>:<uuid>`.
// Matched by shape rather than by the field in front of it — one of these is a person anywhere.
const ACCOUNT_ID = /(?:qm:[0-9a-f]{8}-[0-9a-f-]{27}:[0-9a-f]{8}-[0-9a-f-]{27}|\d{6}:[0-9a-f]{8}-[0-9a-f-]{27}|\b[0-9a-f]{24}\b)/gi;

const hydrated = StateEffect.define<null>();

class IconWidget extends WidgetType {
  constructor(readonly url: string) {
    super();
  }

  eq(other: IconWidget) {
    return other.url === this.url;
  }

  toDOM() {
    const icon = document.createElement('img');
    icon.className = 'jql-value-icon';
    icon.src = this.url;
    icon.alt = '';
    return icon;
  }

  ignoreEvent() {
    return false;
  }
}

/** Drawn over the id; the document still holds the id itself. */
class UserWidget extends WidgetType {
  constructor(readonly name: string, readonly avatarUrl?: string) {
    super();
  }

  eq(other: UserWidget) {
    return other.name === this.name && other.avatarUrl === this.avatarUrl;
  }

  toDOM() {
    const lozenge = document.createElement('span');
    lozenge.className = 'jql-user';
    if (this.avatarUrl) {
      const avatar = document.createElement('img');
      avatar.className = 'jql-user-avatar';
      avatar.src = this.avatarUrl;
      avatar.alt = '';
      lozenge.appendChild(avatar);
    }
    lozenge.appendChild(document.createTextNode(this.name));
    return lozenge;
  }

  ignoreEvent() {
    return false;
  }
}

// exec loop, not matchAll: this build's TypeScript target predates it.
function accountIds(doc: string): { id: string; from: number; to: number }[] {
  const found = [];
  ACCOUNT_ID.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ACCOUNT_ID.exec(doc)) !== null) {
    found.push({ id: match[0], from: match.index, to: match.index + match[0].length });
  }
  return found;
}

// A state field, not a view plugin: CodeMirror requires content-REPLACING decorations to come
// from state. Pure — it reads the cache; the plugin below does the asking.
const valueDecorations = StateField.define<DecorationSet>({
  create: (state) => buildValueDecorations(state.doc.toString()),
  update(value, transaction) {
    if (transaction.docChanged || transaction.effects.some((effect) => effect.is(hydrated))) {
      return buildValueDecorations(transaction.state.doc.toString());
    }
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildValueDecorations(doc: string): DecorationSet {
  const decorations = [];

  // A person replaces the id; an icon only sits in front of its value, which stays editable.
  for (const { id, from, to } of accountIds(doc)) {
    const user = JqlAutocompleteService.userFor(id);
    if (user) {
      decorations.push(Decoration.replace({ widget: new UserWidget(user.displayName, user.avatarUrl) }).range(from, to));
    }
  }

  for (const span of JqlAutocompleteService.highlightSync(doc) ?? []) {
    if (!span.field) {
      continue;
    }
    const url = JqlAutocompleteService.iconFor(span.field, span.text);
    if (url) {
      decorations.push(Decoration.widget({ widget: new IconWidget(url), side: -1 }).range(span.from));
    }
  }

  // true = let CodeMirror sort: the two passes above emit ranges out of document order.
  return Decoration.set(decorations, true);
}

/** Asks Jira about what it has not seen, then tells the editor to repaint. */
const valueHydration = ViewPlugin.fromClass(
  class {
    // Latched, not derived from the spans: a value with no icon of its own would otherwise
    // read as "still unresolved" forever, and every update below would ask again.
    private askedForIcons = false;

    constructor(view: EditorView) {
      this.hydrate(view);
    }

    update(update: ViewUpdate) {
      // Unconditionally, as jqlHighlighting does. At construction the engine has usually not
      // loaded yet, so there are no spans to resolve; the empty transaction dispatched when it
      // lands is not a doc change, and gating on one left a pre-filled query without its icons
      // until the first keystroke. hydrate() is a no-op once nothing is unresolved.
      this.hydrate(update.view);
    }

    private hydrate(view: EditorView) {
      const doc = view.state.doc.toString();
      const unknownUsers = [
        ...new Set(
          accountIds(doc)
            .map(({ id }) => id)
            .filter((id) => JqlAutocompleteService.userFor(id) === undefined)
        ),
      ];
      // Both icon lists are fetched once, the first time any value could carry one.
      const wantsIcons = !this.askedForIcons && (JqlAutocompleteService.highlightSync(doc) ?? []).some((span) => span.field);
      if (!unknownUsers.length && !wantsIcons) {
        return;
      }
      const work = unknownUsers.map((id) => JqlAutocompleteService.hydrateUser(id));
      if (wantsIcons) {
        this.askedForIcons = true;
        work.push(JqlAutocompleteService.hydrateIcons().then(() => undefined));
      }
      // Dispatching inside the update itself is what CodeMirror forbids; this runs after.
      Promise.all(work).then(() => view.dispatch({ effects: hydrated.of(null) }));
    }
  }
);

async function jqlCompletions(context: CompletionContext): Promise<CompletionResult | null> {
  const text = context.state.doc.toString();
  const { items, replace } = await JqlAutocompleteService.suggest(text, context.pos);
  if (!items.length) {
    return null;
  }
  const [from, to] = replace;
  return {
    from,
    to,
    // Already filtered by the engine and by Jira; CM re-filtering on the label would drop
    // values whose display name does not start with what was typed.
    filter: false,
    options: items.map((item) => ({
      label: item.label,
      type: item.kind,
      // Each item replaces its OWN range, not CM's from/to — after "issuetype = Bug " a keyword
      // inserts at the caret while a function replaces the operand behind it.
      apply: (view: EditorView) => {
        const [from, to] = item.replace;
        const insert = JqlAutocompleteService.insertionFor(text, to, item.value);
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
          userEvent: 'input.complete',
        });
        // Accepting is when the context changed, so offer what comes next.
        startCompletion(view);
      },
    })),
  };
}

export function createJqlEditor(options: {
  parent: HTMLElement;
  doc: string;
  placeholder?: string;
  onChange: (doc: string) => void;
  onFocusChange?: (focused: boolean) => void;
  /**
   * Keep the query on ONE line — for an editor sitting in a toolbar row rather
   * than a dialog, where growing vertically would shove the layout around.
   *
   * Drops line wrapping and the Shift-Enter newline binding, rejects any
   * transaction that would produce a second line, and flattens pasted
   * multi-line text to spaces rather than silently refusing the paste.
   */
  singleLine?: boolean;
}): EditorView {
  const extensions: Extension[] = [
    history(),
    ...(options.singleLine
      ? [
          EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)),
          EditorView.domEventHandlers({
            paste: (event, view) => {
              const text = event.clipboardData?.getData('text/plain');
              if (!text || !/[\r\n]/.test(text)) {
                return false;
              }
              // The transactionFilter above would reject this paste outright,
              // which reads as "paste is broken". Flatten it instead.
              event.preventDefault();
              const flattened = text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
              view.dispatch(view.state.replaceSelection(flattened));
              return true;
            },
          }),
        ]
      : [EditorView.lineWrapping]),
    placeholder(options.placeholder ?? ''),
    jqlTheme,
    jqlHighlighting,
    valueDecorations,
    valueHydration,
    // The caret steps over a lozenge instead of into the hidden id behind it.
    EditorView.atomicRanges.of((view) => view.state.field(valueDecorations, false) ?? Decoration.none),
    // Escape dismisses the suggestion list — completionKeymap calls preventDefault but not
    // stopPropagation, and Angular Material's dialog matches on the keycode alone without
    // checking defaultPrevented, so one Escape closed both. This must run BEFORE the keymap
    // below, or the list is already shut and completionStatus reads null; keymap sits at
    // Prec.default, so Prec.highest wins outright instead of relying on array order. Returning
    // false leaves the keymap to actually close the list. Escape with no list open still
    // reaches the dialog and closes it, as it should.
    Prec.highest(
      EditorView.domEventHandlers({
        keydown: (event, view) => {
          if (event.key === 'Escape' && completionStatus(view.state) === 'active') {
            event.stopPropagation();
          }
          return false;
        },
      })
    ),
    autocompletion({ override: [jqlCompletions], activateOnTyping: true, closeOnBlur: true }),
    keymap.of([
      // Enter accepts a suggestion, and is otherwise swallowed rather than splitting the query
      // across lines. Shift-Enter still makes one, as in Jira.
      ...completionKeymap,
      { key: 'Enter', run: () => true },
      // Shift-Enter makes a newline only where newlines are allowed at all.
      ...(options.singleLine ? [{ key: 'Shift-Enter', run: () => true }] : [{ key: 'Shift-Enter', run: insertNewline }]),
      ...historyKeymap,
      ...defaultKeymap,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.focusChanged) {
        options.onFocusChange?.(update.view.hasFocus);
      }
      if (!update.docChanged) {
        return;
      }
      options.onChange(update.state.doc.toString());

      // CM's activate-on-typing reads whitespace as the end of a word and closes the list, but
      // a space is exactly when the next suggestions are wanted. Ask again explicitly.
      let typedWhitespace = false;
      for (const transaction of update.transactions) {
        if (!transaction.isUserEvent('input')) {
          continue;
        }
        transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
          if (/^\s+$/.test(inserted.toString())) {
            typedWhitespace = true;
          }
        });
      }
      if (typedWhitespace) {
        startCompletion(update.view);
      }
    }),
  ];

  return new EditorView({
    parent: options.parent,
    state: EditorState.create({ doc: options.doc, extensions }),
  });
}
