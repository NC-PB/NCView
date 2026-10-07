/**
 * @typedef {"g-code" | "m-code" | "f-code" | "s-code" | "t-code" | "coordinate" | "comment"
 *   | "block" | "keyword" | "variable" | "string" | "section"} TokenKind
 * @typedef {{ text: string, kind: TokenKind | null }} Token
 * @typedef {"iso" | "heidenhain" | "sinumerik"} Dialect
 * @typedef {TokenKind | null | (TokenKind | null)[] | ((match: RegExpExecArray) => TokenKind | null)} RuleKind
 * @typedef {[RegExp, RuleKind]} Rule
 */

/** @type {{ id: Dialect, name: string }[]} */
export const DIALECTS = [
  { id: "iso", name: "ISO / Fanuc" },
  { id: "heidenhain", name: "Heidenhain" },
  { id: "sinumerik", name: "Sinumerik" },
];

// Each dialect is an ordered list of rules. At every position the first rule that matches
// there wins, the way gEdit's Monarch grammars work, so order is meaning: comments before
// words, keywords before addresses, and a catch-all for unknown names last, so a name we
// have no meaning for stays one neutral word instead of a scatter of coloured letters.
//
// A rule's kind is one kind for the whole match, one per capture group (the groups must
// cover the match), or a function of the match. `null` means plain text.

/**
 * @param {string} source
 * @param {RuleKind} kind
 * @returns {Rule}
 */
const rule = (source, kind) => [new RegExp(source, "iy"), kind];

/** @param {string} text */
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Words as one alternation, longest first so `CYCL CALL PAT` is tried before `CYCL CALL`.
 * The words of a multi-word keyword may be separated by any whitespace.
 * @param {Iterable<string>} words
 */
const alternation = (words) =>
  [...new Set(words)]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((word) => escape(word).replace(/ /g, "\\s+"))
    .join("|");

const NUMBER = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)";
const PLAIN_NUMBER = rule("\\d+\\.?\\d*|\\.\\d+", null);
const WHITESPACE = rule("\\s+", null);

// ---------------------------------------------------------------------------------------
// ISO / Fanuc: words may be packed without spaces (G01X10Y20), `( … )` and `;` comments.

/** @type {Record<string, TokenKind>} */
const ISO_WORD_KINDS = {
  G: "g-code",
  M: "m-code",
  F: "f-code",
  S: "s-code",
  T: "t-code",
  X: "coordinate",
  Y: "coordinate",
  Z: "coordinate",
  A: "coordinate",
  B: "coordinate",
  C: "coordinate",
  I: "coordinate",
  J: "coordinate",
  K: "coordinate",
};

/** @type {Rule[]} */
const ISO_RULES = [
  WHITESPACE,
  // An unterminated `(` comment runs to the end of the line.
  rule("\\([^)]*\\)?", "comment"),
  rule(";.*", "comment"),
  rule("(?<![A-Za-z])N\\d+", "block"),
  rule("#\\d+", "variable"),
  // An address word: a letter and a number. A letter preceded by another letter is not an
  // address (the X in "MAX10").
  rule(`(?<![A-Za-z])([A-Za-z])${NUMBER}`, (m) => ISO_WORD_KINDS[m[1].toUpperCase()] ?? null),
];

// ---------------------------------------------------------------------------------------
// Heidenhain Klartext. Keywords and codes follow gEdit's `heidenhain-klartext` profile and
// `heidenhain` code database: words are separated by whitespace, the block number is the
// leading integer, values may be Q parameters and an `I` makes an axis incremental.

const KLARTEXT_KEYWORDS = [
  "BEGIN PGM", "END PGM", "BLK FORM", "TOOL CALL", "TOOL DEF", "CYCL DEF", "CYCL CALL PAT",
  "CYCL CALL POS", "CYCL CALL", "CALL LBL", "CALL PGM", "SEL PGM", "LBL", "REP", "APPR LT",
  "APPR LN", "APPR CT", "APPR LCT", "DEP LT", "DEP LN", "DEP CT", "DEP LCT", "RND", "CHF",
  "CTP", "CT", "CP", "CC", "CR", "LP", "LN", "FMAX", "FAUTO", "FN", "STOP", "PLANE SPATIAL",
  "PLANE RESET", "PLANE PROJECTED", "PLANE EULER", "PLANE VECTOR", "PLANE POINTS",
  "PLANE RELATIV", "PLANE AXIAL", "MOVE", "TURN", "STAY", "TABLE ROT", "COORD ROT", "SEQ+",
  "SEQ-", "MB", "MAX", "FUNCTION TCPM", "FUNCTION RESET TCPM", "F TCP", "F CONT", "AXIS POS",
  "AXIS SPAT", "PATHCTRL AXIS", "PATHCTRL VECTOR", "REFPNT TIP-TIP", "REFPNT TIP-CENTER",
  "REFPNT CENTER-CENTER", "TRANS DATUM", "MM", "INCH",
  // Codes that are words rather than a letter and a number. `R` alone is a radius.
  "R0", "RL", "RR",
];

// A one-letter path function only counts with whitespace or the end of the line behind it,
// or `C+45` (the C axis) and `L+10` (a tool length) would turn into path functions.
const KLARTEXT_SHORT_KEYWORDS = ["L", "C"];

const KLARTEXT_VALUE = "(?:[+-]?(?:\\d+[.,]?\\d*|[.,]\\d+)|[+-]?Q[LRS]?\\d+)";
const WORD_START = "(?<![A-Za-z0-9_])";

/** @type {Rule[]} */
const HEIDENHAIN_RULES = [
  WHITESPACE,
  // A structure block (`12 * - ROUGHING`) is a heading for the whole line.
  rule("^\\s*(?:\\/\\s*)?\\d+\\s+(?:\\/\\s*)?\\*.*", "section"),
  // A comment runs to the end of the line, but leaves the `~` that continues the block.
  rule(";.*?(?=\\s*~\\s*$)", "comment"),
  rule(";.*", "comment"),
  // The tool of a `TOOL CALL`, by number, by name or by QS parameter.
  rule('(?<=TOOL\\s+CALL\\s+)(?:\\d+(?:\\.\\d+)?|"[^"]*"|QS\\d+)', "t-code"),
  rule('"[^"]*"?', "string"),
  rule("^\\s*(?:\\/\\s*)?\\d+(?:\\s*\\/)?(?=\\s|$)", "block"),
  rule(`${WORD_START}(?:${alternation(KLARTEXT_KEYWORDS)})(?![A-Za-z])`, "keyword"),
  rule(`${WORD_START}(?:${alternation(KLARTEXT_SHORT_KEYWORDS)})(?=\\s|$)`, "keyword"),
  rule(`${WORD_START}M\\d{1,3}(?![A-Za-z0-9])`, "m-code"),
  // The rotation direction `DR+` / `DR-`; with a number behind it, it is a delta radius.
  rule(`${WORD_START}DR[+-](?![\\d.,Q])`, "keyword"),
  // Axes may stand without a value (`TOOL CALL 5 Z`), polar coordinates are positions too.
  rule(`${WORD_START}I?[XYZABCUVW](?:${KLARTEXT_VALUE}|(?=\\s|$))`, "coordinate"),
  rule(`${WORD_START}I?P[AR]${KLARTEXT_VALUE}`, "coordinate"),
  rule(`${WORD_START}F[UZ]?${KLARTEXT_VALUE}`, "f-code"),
  rule(`${WORD_START}S${KLARTEXT_VALUE}`, "s-code"),
  rule(`${WORD_START}[+-]?Q[LRS]?\\d+`, "variable"),
  PLAIN_NUMBER,
  rule("[A-Za-z][A-Za-z0-9+\\-.:\\\\/_]*", null),
];

// ---------------------------------------------------------------------------------------
// Siemens Sinumerik 840D. Follows gEdit's `sinumerik` profile and grammar: `;` comments,
// strings before comments, labels, `$` system variables and R parameters, `=` for any value
// that is not a plain number, and a name in front of `(` is a call (a cycle, MSG, …).

const SINUMERIK_KEYWORDS = [
  "IF", "ELSE", "ENDIF", "WHILE", "ENDWHILE", "FOR", "TO", "ENDFOR", "REPEAT", "REPEATB",
  "UNTIL", "LOOP", "ENDLOOP", "CASE", "OF", "DEFAULT", "GOTO", "GOTOF", "GOTOB", "GOTOC",
  "RET", "PROC", "EXTERN", "DEF", "CALL", "PCALL", "MCALL", "EXTCALL", "BLOCK", "AND", "OR",
  "NOT", "XOR", "DIV", "MOD", "B_AND", "B_OR", "B_XOR", "B_NOT", "TRAORI", "TRAFOOF",
  "TRANSMIT", "TRACYL", "TRAANG", "TRANS", "ATRANS", "ROT", "AROT", "RPL", "SCALE", "ASCALE",
  "MIRROR", "AMIRROR", "SUPA", "DIAMON", "DIAMOF", "DIAM90", "SOFT", "BRISK", "FFWON",
  "FFWOF", "COMPON", "COMPCURV", "COMPCAD", "COMPOF", "CUT2D", "CUT3DC", "CFC", "CFTCP",
  "CFIN", "ORIWKS", "ORIMKS", "ORIAXES", "ORIVECT", "ORIEULER", "ORIRPY", "ORIRPY2",
  "ORIPLANE", "ORIPATH", "ORIRESET", "STOPRE", "CIP", "CT", "AC", "IC", "DC", "ACP", "ACN",
  "INT", "REAL", "BOOL", "CHAR", "STRING", "AXIS", "FRAME", "SETMS", "DYNNORM", "DYNPOS",
  "DYNROUGH", "DYNSEMIFIN", "DYNFINISH", "DYNPREC",
];

const SINUMERIK_VALUE = "\\s*[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:EX[+-]?\\d+)?";
const ASSIGNED = "(?=\\s*=(?!=))";
const LABEL = "[A-Za-z_]\\w*:(?!=)";
const SKIP = "\\s*(?:\\/\\d?\\s*)?";

/** Known addresses and their kind, multi-letter ones first. */
const SINUMERIK_ADDRESSES = /** @type {const} */ ([
  ["CR|AR|AP|RP", "coordinate"],
  ["T", "t-code"],
  ["[XYZABCIJK]", "coordinate"],
  ["F", "f-code"],
  ["S", "s-code"],
]);

/** @type {Rule[]} */
const SINUMERIK_RULES = [
  WHITESPACE,
  rule("^%(?:_N_)?\\w+_(?:MPF|SPF).*", "section"),
  rule('"[^"]*"?', "string"),
  rule(";.*", "comment"),
  // The head of a block: `[/n] [N10] LABEL:`. The skip mark is shown like a block number.
  rule(`^(${SKIP})(N\\d+)([ \\t]+)(${LABEL})`, ["block", "block", null, "section"]),
  rule(`^(${SKIP})(${LABEL})`, ["block", "section"]),
  rule("^\\s*\\/\\d?", "block"),
  rule("^\\s*:\\d+", "block"),
  rule("N\\d+", "block"),
  rule("\\$[A-Za-z_]\\w*", "variable"),
  rule("R\\d+(?![\\w.])", "variable"),
  rule("R(?=\\s*\\[)", "variable"),
  // A G code has at most three digits and no decimal part on this control.
  rule("G\\s*\\d{1,3}(?![\\d.])", "g-code"),
  rule("M\\s*\\d+(?![\\d.])", "m-code"),
  // `L100` calls a subprogram by number.
  rule("L\\d+(?![\\d.])", "keyword"),
  // A known address written with `=` keeps its kind (`X=AC(10)`, `T="DRILL"`); any other
  // assignment word is a keyword, so `S3=2400` (another spindle) never looks like the speed.
  ...SINUMERIK_ADDRESSES.map(([names, kind]) => rule(`(?:${names})${ASSIGNED}`, kind)),
  rule(`[A-Za-z_]\\w{0,63}\\[[^\\]]{1,63}\\]${ASSIGNED}`, "keyword"),
  rule(`[A-Za-z_]\\w{0,63}${ASSIGNED}`, "keyword"),
  ...SINUMERIK_ADDRESSES.map(([names, kind]) => rule(`(?:${names})${SINUMERIK_VALUE}`, kind)),
  // A call: a name in front of `(`, e.g. CYCLE83(…), MSG("…").
  rule("[A-Za-z_]\\w*(?=\\()|[A-Za-z_]{2}\\w*(?=\\s+\\()", "keyword"),
  rule(`(?:${alternation(SINUMERIK_KEYWORDS)})(?![A-Za-z0-9_])`, "keyword"),
  rule("[A-Za-z_]\\w*", null),
  rule("'[HB][0-9A-F \\t]*'", null),
  rule("\\d+\\.?\\d*(?:EX[+-]?\\d+)?|\\.\\d+", null),
];

/** @type {Record<Dialect, Rule[]>} */
const RULES = {
  iso: ISO_RULES,
  heidenhain: HEIDENHAIN_RULES,
  sinumerik: SINUMERIK_RULES,
};

/**
 * Splits file content into lines, handling LF, CRLF and CR line endings.
 * A trailing line terminator does not produce an extra empty line.
 * @param {string} content
 * @returns {string[]}
 */
export function splitLines(content) {
  if (content === "") return [];
  const lines = content.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/**
 * Splits one line of NC code into highlighted tokens. Concatenating the token texts always
 * reproduces the input line exactly.
 * @param {string} line
 * @param {Dialect} [dialect]
 * @returns {Token[]}
 */
export function tokenizeLine(line, dialect = "iso") {
  const rules = RULES[dialect];
  /** @type {Token[]} */
  const tokens = [];
  let plain = "";

  /**
   * @param {string | undefined} text
   * @param {TokenKind | null} kind
   */
  const push = (text, kind) => {
    if (!text) return;
    if (kind === null) {
      plain += text;
      return;
    }
    if (plain) tokens.push({ text: plain, kind: null });
    plain = "";
    tokens.push({ text, kind });
  };

  let pos = 0;
  scan: while (pos < line.length) {
    for (const [re, kind] of rules) {
      re.lastIndex = pos;
      const match = re.exec(line);
      if (!match || match[0] === "") continue;

      if (Array.isArray(kind)) kind.forEach((groupKind, i) => push(match[i + 1], groupKind));
      else push(match[0], typeof kind === "function" ? kind(match) : kind);
      pos += match[0].length;
      continue scan;
    }
    plain += line[pos];
    pos += 1;
  }

  if (plain) tokens.push({ text: plain, kind: null });
  return tokens;
}

/**
 * Guesses the dialect of a program from its file name and content. The extension decides
 * where it is unambiguous; otherwise the first lines are scored for each control's
 * hallmarks, and ISO / Fanuc is the fallback.
 * @param {string} name
 * @param {string} content
 * @returns {Dialect}
 */
export function detectDialect(name, content) {
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (extension === "h") return "heidenhain";
  if (extension === "mpf" || extension === "spf") return "sinumerik";

  const head = content.slice(0, 20000);
  if (/^\s*\d+\s+BEGIN\s+PGM\b/im.test(head)) return "heidenhain";
  if (/^%_N_\w+_(?:MPF|SPF)|^;\$PATH=/im.test(head)) return "sinumerik";

  /** @param {RegExp} re */
  const count = (re) => head.match(re)?.length ?? 0;
  const heidenhain =
    count(/^\s*\d+\s+(?:TOOL\s+CALL|CYCL\s+DEF|LBL|CALL\s+LBL|L\s|CC\s|C\s|CR\s|CT\s|RND\s|APPR|DEP)/gim) +
    count(/\bFMAX\b/gi);
  const sinumerik =
    count(/\bCYCLE\d+\s*\(/gi) +
    count(/\bMSG\s*\(/gi) +
    count(/\bDEF\s+(?:REAL|INT|BOOL|STRING)\b/gi) +
    count(/\bGOTO[FBC]?\b/gi) +
    count(/=\s*(?:AC|IC|DC|ACP|ACN)\s*\(/gi) +
    count(/\bT\s*=\s*"/gi) +
    count(/\b(?:DIAMON|DIAMOF|TRAORI|TRAFOOF|TRANSMIT|SUPA|STOPRE)\b/gi);

  if (heidenhain >= 3 && heidenhain > sinumerik) return "heidenhain";
  if (sinumerik >= 2 && sinumerik > heidenhain) return "sinumerik";
  return "iso";
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
