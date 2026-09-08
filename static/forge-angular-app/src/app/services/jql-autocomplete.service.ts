import { JiraService } from './jira.service';

/**
 * JQL autocomplete without the React editor: `@atlaskit/jql-autocomplete` is Jira's own ANTLR
 * grammar with no React peer dependency. Imported dynamically — ~158KB gzipped.
 */

export type JqlSpan = {
  text: string;
  cls: string;
  from: number;
  to: number;
  /** For a value, the field it belongs to: "Bug" after issuetype takes a different icon than
   *  "Bug" after summary. Value spans only, simple `field op value` shapes only. */
  field?: string;
};

export type JqlSuggestion = {
  /** Inserted as-is; Jira quotes it where quoting is needed. */
  value: string;
  label: string;
  kind: 'field' | 'operator' | 'value' | 'function' | 'keyword';
  /**
   * The [start, end) THIS item replaces — not shared across a caret. After "issuetype = Bug "
   * a keyword inserts at the caret while a function replaces back over "Bug".
   */
  replace: [number, number];
};

export type JqlSuggestions = { items: JqlSuggestion[]; replace: [number, number] };

const EMPTY: JqlSuggestions = { items: [], replace: [0, 0] };
const MAX_ITEMS = 50;

// Jira wraps the matched substring in <b>, so "Bug" arrives as "<b>B</b>ug". Decode &amp; last,
// or the other entities decode twice.
const plainText = (html: string) =>
  (html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const bare = (s: string) => (s || '').replace(/^["']|["']$/g, '').toLowerCase();

/**
 * Token name -> CSS class, names from JQLLexer.VOCABULARY (check-jql-engine.mjs fails if one
 * disappears). STRING is absent on purpose: it is a field in one position and a value in
 * another, which only the preceding token settles — see highlight().
 */
const TOKEN_CLASS: { [name: string]: string } = {
  EQUALS: 'jql-operator', NOT_EQUALS: 'jql-operator', LIKE: 'jql-operator', NOT_LIKE: 'jql-operator',
  LT: 'jql-operator', GT: 'jql-operator', GTEQ: 'jql-operator', LTEQ: 'jql-operator', BANG: 'jql-operator',
  IN: 'jql-operator', IS: 'jql-operator', WAS: 'jql-operator', CHANGED: 'jql-operator',
  AND: 'jql-keyword', OR: 'jql-keyword', NOT: 'jql-keyword',
  ORDER: 'jql-keyword', BY: 'jql-keyword', ASC: 'jql-keyword', DESC: 'jql-keyword',
  BEFORE: 'jql-keyword', AFTER: 'jql-keyword', FROM: 'jql-keyword', TO: 'jql-keyword',
  ON: 'jql-keyword', DURING: 'jql-keyword', RESERVED_WORD: 'jql-keyword',
  // Plain text in Jira, like any other operand.
  EMPTY: '', LPAREN: '', RPAREN: '', COMMA: '', LBRACKET: '', RBRACKET: '',
  POSNUMBER: '', NEGNUMBER: '',
  CUSTOMFIELD: 'jql-field',
  ERRORCHAR: 'jql-error', ERROR_RESERVED: 'jql-error',
  UNCLOSED_QUOTE_STRING: 'jql-error', INVALID_QUOTE_STRING: 'jql-error',
  UNCLOSED_SQUOTE_STRING: 'jql-error', INVALID_SQUOTE_STRING: 'jql-error',
};

const STARTS_CLAUSE = new Set(['AND', 'OR', 'NOT', 'ORDER', 'BY']);
const STARTS_VALUE = new Set(['EQUALS', 'NOT_EQUALS', 'LIKE', 'NOT_LIKE', 'LT', 'GT', 'GTEQ', 'LTEQ', 'IN', 'IS', 'WAS', 'CHANGED']);

/**
 * The engine's `util`/`assert` shims read `process` as they evaluate, so the chunk threw
 * `ReferenceError: process is not defined` in the browser. Installed immediately before the
 * import rather than in polyfills.ts: a global `process` at startup makes libraries that sniff
 * for it take their Node path, and by now everything eager has already decided.
 */
function ensureProcessShim() {
  const scope = globalThis as any;
  if (scope.process) {
    return;
  }
  const noop = () => undefined;
  scope.process = {
    env: {},
    argv: [],
    version: '',
    versions: {},
    platform: 'browser',
    pid: 0,
    nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
    // Off globalThis: this build's tsconfig lib predates BigInt, and changing it is not this port's business.
    hrtime: Object.assign(() => [0, 0], { bigint: () => (globalThis as any).BigInt(0) }),
    emitWarning: noop,
    cwd: () => '/',
    stdout: { write: noop },
    stderr: { write: noop },
    noDeprecation: false,
    throwDeprecation: false,
    traceDeprecation: false,
  };
}

export class JqlAutocompleteService {
  /** Latched on first failure: otherwise a broken engine costs a stack trace per keystroke. */
  private static broken = false;
  private static enginePromise: Promise<any>;
  private static lexerPromise: Promise<any>;
  /** Kept resolved so highlighting can run in the same task as the keypress. */
  private static lexerModule: any;
  private static vocabularyPromise: Promise<any>;

  private static engine(): Promise<any> {
    if (!this.enginePromise) {
      ensureProcessShim();
      this.enginePromise = import('@atlaskit/jql-autocomplete');
    }
    return this.enginePromise;
  }

  private static lexer(): Promise<any> {
    if (!this.lexerPromise) {
      ensureProcessShim();
      this.lexerPromise = Promise.all([import('@atlaskit/jql-parser'), import('antlr4ts')]).then((modules) => {
        this.lexerModule = modules;
        return modules;
      });
    }
    return this.lexerPromise;
  }

  /** Fetch both chunks when the modal opens; on the first keystroke it is a 300ms stall. */
  static preload(): Promise<unknown> {
    return Promise.all([this.engine().catch(() => undefined), this.lexer().catch(() => undefined)]);
  }

  /** Fields, their operators and functions: same for every query, so fetched once. */
  private static vocabulary(): Promise<any> {
    if (!this.vocabularyPromise) {
      this.vocabularyPromise = JiraService.AP.request({
        url: '/rest/api/3/jql/autocompletedata',
        type: 'POST',
        data: JSON.stringify({}),
      })
        .then((res) => res)
        .catch((e) => {
          // Never take the field down over autocomplete; retry on the next keystroke.
          console.warn('JQL autocomplete unavailable', e);
          this.vocabularyPromise = undefined;
          return { visibleFieldNames: [], visibleFunctionNames: [] };
        });
    }
    return this.vocabularyPromise;
  }

  static async suggest(text: string, caret: number): Promise<JqlSuggestions> {
    if (this.broken) {
      return EMPTY;
    }
    let rules;
    let tokens;
    try {
      const { JQLAutocomplete } = await this.engine();
      // Position is a TUPLE, [start, end] — passing {start, end} throws inside the engine.
      ({ rules, tokens } = JQLAutocomplete.fromText(text).getJQLSuggestionsForCaretPosition([caret, caret]));
    } catch (e) {
      console.warn('JQL engine unavailable — suggestions and colouring are off', e);
      this.broken = true;
      return EMPTY;
    }

    // The token under the caret — what the keywords filter against and replace.
    const tokenRange = (tokens.replacePosition ?? [caret, caret]) as [number, number];
    const tokenTyped = (tokens.matchedText ?? '').trim();

    const vocabulary = await this.vocabulary();
    const items: JqlSuggestion[] = [];

    /** Filter a group by ITS OWN rule's matched text, and stamp it with ITS OWN range. */
    const offer = (rule, group: Omit<JqlSuggestion, 'replace'>[]) => {
      const replace = (rule.replacePosition ?? tokenRange) as [number, number];
      items.push(...this.filter(group, (rule.matchedText ?? '').trim()).map((item) => ({ ...item, replace })));
    };

    const fieldRule = rules.field || rules.customField;
    if (fieldRule) {
      offer(
        fieldRule,
        (vocabulary.visibleFieldNames || []).map((f) => ({ value: f.value, label: plainText(f.displayName), kind: 'field' as const }))
      );
    }

    if (rules.operator) {
      const field = rules.operator.context?.field;
      const entry = (vocabulary.visibleFieldNames || []).find((f) => bare(f.value) === bare(field));
      offer(
        rules.operator,
        (entry?.operators || []).map((op) => ({ value: op, label: op, kind: 'operator' as const }))
      );
    }

    const valueRule = rules.value || rules.list;
    if (valueRule) {
      const values = await this.values(valueRule.context?.field, (valueRule.matchedText ?? '').trim());
      const replace = (valueRule.replacePosition ?? tokenRange) as [number, number];
      items.push(...values.map((item) => ({ ...item, replace })));
    }

    if (rules.function) {
      offer(
        rules.function,
        (vocabulary.visibleFunctionNames || []).map((f) => ({
          value: f.value,
          label: plainText(f.displayName),
          kind: 'function' as const,
        }))
      );
    }

    // Keywords are literal tokens, filtered by the token under the caret — never by a rule's
    // range. Typed explicitly: `tokens` is any, and an inferred group loses `kind` in filter().
    const keywords: Omit<JqlSuggestion, 'replace'>[] = (tokens.values || []).map((value: string) => ({
      value,
      label: value,
      kind: 'keyword' as const,
    }));
    items.push(...this.filter(keywords, tokenTyped).map((item) => ({ ...item, replace: tokenRange })));

    return items.length ? { items: items.slice(0, MAX_ITEMS), replace: tokenRange } : { ...EMPTY, replace: tokenRange };
  }

  /**
   * Colour the query from the same lexer the suggestions use, so the two never disagree about
   * where a token starts. Roles are inferred lexically — exotic shapes (predicate arguments
   * after WAS … BY) can mis-colour, but the text and the suggestions stay correct.
   *
   * ponytail: lexical role inference, swap in @atlaskit/jql-ast if it is ever worth ~200KB.
   */
  static async highlight(text: string): Promise<JqlSpan[]> {
    const ready = this.highlightSync(text);
    if (ready) {
      return ready;
    }
    await this.lexer().catch(() => undefined);
    return this.highlightSync(text) ?? [{ text, cls: '', from: 0, to: text.length }];
  }

  /** The keystroke path: null only while the lexer chunk is still loading. */
  static highlightSync(text: string): JqlSpan[] | null {
    if (!text || this.broken) {
      return text ? [{ text, cls: '', from: 0, to: text.length }] : [];
    }
    if (!this.lexerModule) {
      this.lexer();
      return null;
    }
    let tokens;
    try {
      const [{ JQLLexer }, { CharStreams, CommonTokenStream }] = this.lexerModule;
      const lexer = new JQLLexer(CharStreams.fromString(text));
      // Half-typed JQL is normal here; the default listener logs every stray character.
      lexer.removeErrorListeners();
      const stream = new CommonTokenStream(lexer);
      stream.fill();
      tokens = { list: stream.getTokens(), vocabulary: JQLLexer.VOCABULARY };
    } catch (e) {
      console.warn('JQL highlighting unavailable', e);
      this.broken = true;
      return [{ text, cls: '', from: 0, to: text.length }];
    }

    const spans: JqlSpan[] = [];
    let expect: 'field' | 'value' = 'field';
    let field: string | undefined;
    let cursor = 0;

    tokens.list.forEach((token, i) => {
      const name = tokens.vocabulary.getSymbolicName(token.type);
      if (!name || token.startIndex > token.stopIndex) {
        return; // EOF, and anything else with no text of its own
      }
      if (token.startIndex > cursor) {
        spans.push({ text: text.slice(cursor, token.startIndex), cls: '', from: cursor, to: token.startIndex });
      }
      const raw = text.slice(token.startIndex, token.stopIndex + 1);
      // Only fields are coloured; values, function names and quoted strings are plain in Jira.
      let cls = TOKEN_CLASS[name] ?? '';
      if (!cls && /STRING/.test(name) && expect === 'field') {
        cls = 'jql-field';
        field = bare(raw);
      }
      if (STARTS_VALUE.has(name)) {
        expect = 'value';
      } else if (STARTS_CLAUSE.has(name)) {
        expect = 'field';
        field = undefined;
      }
      spans.push({
        text: raw,
        cls,
        from: token.startIndex,
        to: token.stopIndex + 1,
        field: !cls && expect === 'value' ? field : undefined,
      });
      cursor = token.stopIndex + 1;
    });

    if (cursor < text.length) {
      spans.push({ text: text.slice(cursor), cls: '', from: cursor, to: text.length });
    }
    return spans;
  }

  /**
   * `validation=strict` is what adds the semantic errors ("the value 'ABC' does not exist for
   * field 'project'") to the syntactic ones. An invalid query still returns 200 with the
   * errors in the payload, so a non-2xx means the request failed and is not the user's problem.
   */
  static async validate(jql: string): Promise<string[]> {
    if (!jql.trim()) {
      return [];
    }
    try {
      const res = await JiraService.AP.request({
        url: '/rest/api/3/jql/parse?validation=strict',
        type: 'POST',
        data: JSON.stringify({ queries: [jql] }),
      });
      const { queries = [] } = res;
      return queries[0]?.errors ?? [];
    } catch (e) {
      console.warn('JQL validation unavailable', e);
      return [];
    }
  }

  /** Account ids resolved to people. `null` marks one Jira would not resolve — never re-asked. */
  private static users = new Map<string, { displayName: string; avatarUrl?: string } | null>();
  private static pendingUsers = new Map<string, Promise<void>>();

  /** `null` = unresolvable, `undefined` = not asked yet. */
  static userFor(accountId: string) {
    return this.users.get(accountId);
  }

  static hydrateUser(accountId: string): Promise<void> {
    if (this.users.has(accountId)) {
      return Promise.resolve();
    }
    let pending = this.pendingUsers.get(accountId);
    if (!pending) {
      pending = JiraService.AP.request(`/rest/api/3/user?accountId=${encodeURIComponent(accountId)}`)
        .then((user) => {
          this.users.set(accountId, { displayName: user.displayName, avatarUrl: user.avatarUrls?.['24x24'] });
        })
        .catch(() => {
          // Deactivated or invisible: the id stays on screen as typed, and the miss is kept.
          this.users.set(accountId, null);
        })
        .finally(() => this.pendingUsers.delete(accountId));
      this.pendingUsers.set(accountId, pending);
    }
    return pending;
  }

  /** Issue-type and priority icons keyed "<field>:<value>"; both lists fetched whole, once. */
  private static icons = new Map<string, string>();
  private static iconsPromise: Promise<unknown>;

  static iconFor(field: string, value: string): string | undefined {
    return this.icons.get(`${bare(field)}:${bare(value)}`);
  }

  static hydrateIcons(): Promise<unknown> {
    if (!this.iconsPromise) {
      this.iconsPromise = Promise.all([
        this.loadIcons('/rest/api/3/issuetype', ['issuetype', 'type']),
        this.loadIcons('/rest/api/3/priority', ['priority']),
      ]);
    }
    return this.iconsPromise;
  }

  private static async loadIcons(url: string, fields: string[]) {
    try {
      const res = await JiraService.AP.request(url);
      for (const entry of res || []) {
        if (!entry?.name || !entry?.iconUrl) {
          continue;
        }
        // `type` is JQL's alias for `issuetype`; both spellings appear in real queries.
        for (const field of fields) {
          this.icons.set(`${field}:${bare(entry.name)}`, entry.iconUrl);
        }
      }
    } catch (e) {
      console.warn(`JQL icons unavailable from ${url}`, e);
    }
  }

  /**
   * How many issues the query matches. `approximate-count` is the supported replacement for
   * the old search `total`; it is an estimate on large results, which is what "27 matching
   * items" needs to be anyway. `null` when Jira will not answer.
   */
  static async matchCount(jql: string): Promise<number | null> {
    if (!jql.trim()) {
      return null;
    }
    try {
      const res = await JiraService.AP.request({
        url: '/rest/api/3/search/approximate-count',
        type: 'POST',
        data: JSON.stringify({ jql }),
      });
      const { count } = res;
      return typeof count === 'number' ? count : null;
    } catch (e) {
      console.warn('JQL match count unavailable', e);
      return null;
    }
  }

  /** Jira filters values server-side, so `typed` goes with the request. */
  private static async values(field: string, typed: string): Promise<Omit<JqlSuggestion, 'replace'>[]> {
    if (!field) {
      return [];
    }
    try {
      const url =
        `/rest/api/3/jql/autocompletedata/suggestions?fieldName=${encodeURIComponent(bare(field))}` +
        (typed ? `&fieldValue=${encodeURIComponent(bare(typed))}` : '');
      const res = await JiraService.AP.request(url);
      const { results = [] } = res;
      return results.map((r) => ({ value: r.value, label: plainText(r.displayName) || r.value, kind: 'value' as const }));
    } catch (e) {
      // A free-text or numeric field has no value suggestions; that is ordinary, not an error.
      console.warn(`No JQL value suggestions for ${field}`, e);
      return [];
    }
  }

  /**
   * Subsequence rank: "issty" matches "issueType". Lower is better, -1 is no match; a prefix
   * wins outright, then contiguous runs, then scattered letters.
   */
  private static rank(candidate: string, needle: string): number {
    const hay = (candidate || '').toLowerCase();
    if (hay.startsWith(needle)) {
      return 0;
    }
    let cursor = 0;
    let gaps = 1; // never better than a prefix match
    let previous = -2;
    for (const character of needle) {
      const found = hay.indexOf(character, cursor);
      if (found === -1) {
        return -1;
      }
      if (found !== previous + 1) {
        gaps += 1;
      }
      previous = found;
      cursor = found + 1;
    }
    return gaps;
  }

  private static filter<T extends { value: string; label: string }>(items: T[], typed: string): T[] {
    if (!typed) {
      return items;
    }
    const needle = bare(typed);
    return items
      .map((item) => ({ item, rank: Math.max(this.rank(item.value, needle), this.rank(item.label, needle)) }))
      .filter((scored) => scored.rank >= 0)
      // Stable, so equal ranks keep Jira's ordering.
      .sort((a, b) => a.rank - b.rank)
      .map((scored) => scored.item);
  }

  /** Trailing space, unless the text already has one — or you get "issuetype =  Bug". */
  static insertionFor(text: string, end: number, value: string): string {
    return text[end] === ' ' ? value : `${value} `;
  }
}
