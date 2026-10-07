import { describe, expect, it } from "vitest";
import { detectDialect, formatSize, splitLines, tokenizeLine } from "./gcode.js";

/**
 * @param {string} line
 * @param {import("./gcode.js").Dialect} [dialect]
 */
const kinds = (line, dialect = "iso") =>
  tokenizeLine(line, dialect)
    .filter((t) => t.kind)
    .map((t) => [t.kind, t.text]);

describe("tokenizeLine (ISO / Fanuc)", () => {
  it("highlights spaced words", () => {
    expect(kinds("G1 X10 Y-2.5 F150")).toEqual([
      ["g-code", "G1"],
      ["coordinate", "X10"],
      ["coordinate", "Y-2.5"],
      ["f-code", "F150"],
    ]);
  });

  it("highlights packed words without spaces", () => {
    expect(kinds("G01X10.5Y-20Z.25")).toEqual([
      ["g-code", "G01"],
      ["coordinate", "X10.5"],
      ["coordinate", "Y-20"],
      ["coordinate", "Z.25"],
    ]);
  });

  it("is case-insensitive", () => {
    expect(kinds("g0 x1 m3 s1000 t2")).toEqual([
      ["g-code", "g0"],
      ["coordinate", "x1"],
      ["m-code", "m3"],
      ["s-code", "s1000"],
      ["t-code", "t2"],
    ]);
  });

  it("keeps words inside comments as part of the comment", () => {
    expect(kinds("G1 (Cut to X10 with G1) Y5")).toEqual([
      ["g-code", "G1"],
      ["comment", "(Cut to X10 with G1)"],
      ["coordinate", "Y5"],
    ]);
    expect(kinds("M5 ; stop G0 X0")).toEqual([
      ["m-code", "M5"],
      ["comment", "; stop G0 X0"],
    ]);
  });

  it("treats an unterminated paren comment as running to end of line", () => {
    expect(kinds("G0 (oops X1")).toEqual([
      ["g-code", "G0"],
      ["comment", "(oops X1"],
    ]);
  });

  it("ignores letters that are part of a longer word", () => {
    expect(kinds("MAX10")).toEqual([]);
  });

  it("marks block numbers and macro variables, leaves unknown words plain", () => {
    expect(kinds("N10 G2 X1 R5 #100=2")).toEqual([
      ["block", "N10"],
      ["g-code", "G2"],
      ["coordinate", "X1"],
      ["variable", "#100"],
    ]);
  });

  it("round-trips every character, including HTML-like text", () => {
    const line = "G1 X1 (<img src=x onerror=alert(1)> & stuff) ;<b>";
    expect(
      tokenizeLine(line)
        .map((t) => t.text)
        .join(""),
    ).toBe(line);
  });
});

describe("tokenizeLine (Heidenhain)", () => {
  /** @param {string} line */
  const h = (line) => kinds(line, "heidenhain");

  it("highlights a linear move", () => {
    expect(h("6 L X+50 IY-10 R0 F350 M3")).toEqual([
      ["block", "6"],
      ["keyword", "L"],
      ["coordinate", "X+50"],
      ["coordinate", "IY-10"],
      ["keyword", "R0"],
      ["f-code", "F350"],
      ["m-code", "M3"],
    ]);
  });

  it("reads multi-word keywords and the tool of a TOOL CALL", () => {
    expect(h("3 TOOL CALL 4 Z S3000 F500")).toEqual([
      ["block", "3"],
      ["keyword", "TOOL CALL"],
      ["t-code", "4"],
      ["coordinate", "Z"],
      ["s-code", "S3000"],
      ["f-code", "F500"],
    ]);
    expect(h('4 TOOL CALL "MILL_D10" Z S8000')[2]).toEqual(["t-code", '"MILL_D10"']);
    expect(h("10 END PGM PART_1 MM")).toEqual([
      ["block", "10"],
      ["keyword", "END PGM"],
      ["keyword", "MM"],
    ]);
  });

  it("treats a structure block as a heading", () => {
    expect(h("2 * - ROUGHING G1 X10")).toEqual([["section", "2 * - ROUGHING G1 X10"]]);
  });

  it("reads Q parameters as variables and as axis values", () => {
    expect(h("  Q200=2 ;SAFETY CLEARANCE ~")).toEqual([
      ["variable", "Q200"],
      ["comment", ";SAFETY CLEARANCE"],
    ]);
    expect(h("7 L X+Q5 FMAX")).toEqual([
      ["block", "7"],
      ["keyword", "L"],
      ["coordinate", "X+Q5"],
      ["keyword", "FMAX"],
    ]);
  });

  it("does not take the C axis or a program name for a keyword", () => {
    expect(h("8 L C+45")).toEqual([
      ["block", "8"],
      ["keyword", "L"],
      ["coordinate", "C+45"],
    ]);
    expect(h("0 BEGIN PGM CALIBRATE MM")).toEqual([
      ["block", "0"],
      ["keyword", "BEGIN PGM"],
      ["keyword", "MM"],
    ]);
  });
});

describe("tokenizeLine (Sinumerik)", () => {
  /** @param {string} line */
  const s = (line) => kinds(line, "sinumerik");

  it("highlights packed words and block numbers", () => {
    expect(s("N10G18G90G95 DIAMON")).toEqual([
      ["block", "N10"],
      ["g-code", "G18"],
      ["g-code", "G90"],
      ["g-code", "G95"],
      ["keyword", "DIAMON"],
    ]);
    expect(s("n130 g96 s240 lims=3000 m4")).toEqual([
      ["block", "n130"],
      ["g-code", "g96"],
      ["s-code", "s240"],
      ["keyword", "lims"],
      ["m-code", "m4"],
    ]);
  });

  it("keeps a semicolon inside a string out of the comment", () => {
    expect(s('N30 MSG("ROUGH ; PASS") ; note')).toEqual([
      ["block", "N30"],
      ["keyword", "MSG"],
      ["string", '"ROUGH ; PASS"'],
      ["comment", "; note"],
    ]);
  });

  it("reads assignments, tools by name and other spindles", () => {
    expect(s('N40 T="DRILL_D10" D1')).toEqual([
      ["block", "N40"],
      ["t-code", "T"],
      ["string", '"DRILL_D10"'],
    ]);
    expect(s("N170 S3=2400 M3=3")).toEqual([
      ["block", "N170"],
      ["keyword", "S3"],
      ["m-code", "M3"],
    ]);
    expect(s("X=AC(10) CR=15")).toEqual([
      ["coordinate", "X"],
      ["keyword", "AC"],
      ["coordinate", "CR"],
    ]);
  });

  it("reads cycles, variables, labels and the file header", () => {
    expect(s("N80 CYCLE83(5,0,2,-30,,-8) R1=R2-5 $P_TOOLNO")).toEqual([
      ["block", "N80"],
      ["keyword", "CYCLE83"],
      ["variable", "R1"],
      ["variable", "R2"],
      ["variable", "$P_TOOLNO"],
    ]);
    expect(s("N40 LOOP_A: G0 X0")).toEqual([
      ["block", "N40"],
      ["section", "LOOP_A:"],
      ["g-code", "G0"],
      ["coordinate", "X0"],
    ]);
    expect(s("%_N_FLANGE_MPF")).toEqual([["section", "%_N_FLANGE_MPF"]]);
  });

  it("leaves names it does not know as one plain word", () => {
    expect(s("DEF REAL DEPTH_X1")).toEqual([
      ["keyword", "DEF"],
      ["keyword", "REAL"],
    ]);
  });

  it("round-trips every character", () => {
    const line = '/1 N70 G0 X92 Z2 ; "<b>" & (x)';
    expect(
      tokenizeLine(line, "sinumerik")
        .map((t) => t.text)
        .join(""),
    ).toBe(line);
  });
});

describe("detectDialect", () => {
  it("decides by extension where it can", () => {
    expect(detectDialect("PART.H", "")).toBe("heidenhain");
    expect(detectDialect("shaft.mpf", "")).toBe("sinumerik");
    expect(detectDialect("sub.SPF", "")).toBe("sinumerik");
  });

  it("recognises the program headers", () => {
    expect(detectDialect("part.nc", "0 BEGIN PGM PART MM\n1 L X+0 R0 FMAX\n")).toBe("heidenhain");
    expect(detectDialect("part.txt", "%_N_SHAFT_MPF\nN10 G0 X0\n")).toBe("sinumerik");
  });

  it("scores the content otherwise", () => {
    expect(detectDialect("a.nc", 'N10 T="DRILL" D1\nN20 CYCLE83(5,0,2)\nN30 MSG("X")\n')).toBe("sinumerik");
    expect(detectDialect("a.nc", "%\nO0815\nN10 G90 G54\nN20 T5 M6\nM30\n")).toBe("iso");
  });
});

describe("splitLines", () => {
  it("handles LF, CRLF and CR endings", () => {
    expect(splitLines("G0\nG1\r\nG2\rM30")).toEqual(["G0", "G1", "G2", "M30"]);
  });

  it("does not add a line for a trailing newline", () => {
    expect(splitLines("G1\nM30\n")).toEqual(["G1", "M30"]);
    expect(splitLines("G1\r\nM30\r\n")).toEqual(["G1", "M30"]);
  });

  it("keeps blank lines in the middle and at the end", () => {
    expect(splitLines("G1\n\nM30\n\n")).toEqual(["G1", "", "M30", ""]);
  });

  it("returns no lines for an empty file", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("makes semicolon comments work with CRLF", () => {
    const [line] = splitLines("G1 X1 ;note\r\n");
    expect(kinds(line).at(-1)).toEqual(["comment", ";note"]);
  });
});

describe("formatSize", () => {
  it("picks a sensible unit", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
