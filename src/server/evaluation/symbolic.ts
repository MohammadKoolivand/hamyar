import { parse, type MathNode } from "mathjs";
type Q = readonly [bigint, bigint];
type Polynomial = Map<string, Q>;
export interface MathContext {
  variables: string[];
  domain: "real";
  mode: "expression" | "equation";
}
class Unsupported extends Error {}
const abs = (n: bigint) => (n < 0n ? -n : n);
function rat(n: bigint, d = 1n): Q {
  if (!d) throw new Unsupported("zero_denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = abs(n),
    b = d;
  while (b) {
    [a, b] = [b, a % b];
  }
  const q: Q = [n / (a || 1n), d / (a || 1n)];
  if (abs(q[0]).toString().length > 128 || q[1].toString().length > 128)
    throw new Unsupported("coefficient_limit");
  return q;
}
const add = (a: Q, b: Q) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]),
  mul = (a: Q, b: Q) => rat(a[0] * b[0], a[1] * b[1]);
function decimal(value: number): Q {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9)
    throw new Unsupported("number_limit");
  const [m, exp = "0"] = String(value).toLowerCase().split("e");
  const digits = m.replace(".", ""),
    scale = (m.split(".")[1]?.length ?? 0) - Number(exp);
  if (Math.abs(scale) > 12) throw new Unsupported("precision_limit");
  return scale >= 0
    ? rat(BigInt(digits), 10n ** BigInt(scale))
    : rat(BigInt(digits) * 10n ** BigInt(-scale));
}
function combine(a: Polynomial, b: Polynomial, sign = 1n) {
  const out = new Map(a);
  for (const [k, v] of b) {
    const n = add(out.get(k) ?? rat(0n), mul(v, rat(sign)));
    if (n[0]) out.set(k, n);
    else out.delete(k);
  }
  if (out.size > 64) throw new Unsupported("term_limit");
  return out;
}
function product(a: Polynomial, b: Polynomial) {
  const out = new Map<string, Q>();
  for (const [ka, va] of a)
    for (const [kb, vb] of b) {
      const exps = ka
        .split(",")
        .map((v, i) => Number(v) + Number(kb.split(",")[i]));
      if (exps.reduce((s, n) => s + n, 0) > 4)
        throw new Unsupported("degree_limit");
      const k = exps.join(","),
        v = add(out.get(k) ?? rat(0n), mul(va, vb));
      if (v[0]) out.set(k, v);
      else out.delete(k);
    }
  if (out.size > 64) throw new Unsupported("term_limit");
  return out;
}
function polynomial(input: string, context: MathContext): Polynomial {
  if (input.length > 256 || !/^[\da-zA-Z+\-*/^().\s]+$/.test(input))
    throw new Unsupported("unsupported_syntax");
  let depth = 0;
  for (const ch of input) {
    if (ch === "(" && ++depth > 16) throw new Unsupported("depth_limit");
    if (ch === ")" && --depth < 0) throw new Unsupported("unbalanced");
  }
  if (depth) throw new Unsupported("unbalanced");
  if ((input.match(/[+\-*/^]/g) ?? []).length > 64)
    throw new Unsupported("operator_limit");
  for (const n of input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g) ??
    []) {
    if (n.split(/[eE]/)[0].replace(/[^\d]/g, "").replace(/^0+/, "").length > 12)
      throw new Unsupported("precision_limit");
  }
  const zero = context.variables.map(() => 0).join(",");
  let count = 0;
  function walk(node: MathNode): Polynomial {
    if (++count > 96) throw new Unsupported("node_limit");
    const n = node as MathNode & {
      value?: number;
      name?: string;
      args?: MathNode[];
      op?: string;
      content?: MathNode;
    };
    if (n.type === "ParenthesisNode") return walk(n.content!);
    if (n.type === "ConstantNode")
      return n.value === 0
        ? new Map()
        : new Map([[zero, decimal(Number(n.value))]]);
    if (n.type === "SymbolNode") {
      const index = context.variables.indexOf(n.name!);
      if (index < 0) throw new Unsupported("unknown_variable");
      const exps = context.variables.map(() => 0);
      exps[index] = 1;
      return new Map([[exps.join(","), rat(1n)]]);
    }
    if (n.type !== "OperatorNode" || !["+", "-", "*", "/", "^"].includes(n.op!))
      throw new Unsupported("unsupported_node");
    const a = walk(n.args![0]);
    if (n.args!.length === 1)
      return n.op === "-" ? product(new Map([[zero, rat(-1n)]]), a) : a;
    const b = walk(n.args![1]);
    switch (n.op) {
      case "+":
        return combine(a, b);
      case "-":
        return combine(a, b, -1n);
      case "*":
        return product(a, b);
      case "/": {
        if (b.size !== 1 || !b.has(zero))
          throw new Unsupported("variable_or_zero_denominator");
        const v = b.get(zero)!;
        return product(a, new Map([[zero, rat(v[1], v[0])]]));
      }
      case "^": {
        if (b.size === 0) {
          if (a.size !== 1 || !a.has(zero))
            throw new Unsupported("zero_power_domain");
          return new Map([[zero, rat(1n)]]);
        }
        const v = b.get(zero);
        if (b.size !== 1 || !v || v[1] !== 1n || v[0] < 0n || v[0] > 4n)
          throw new Unsupported("unsupported_power");
        let out: Polynomial = new Map([[zero, rat(1n)]]);
        for (let i = 0n; i < v[0]; i++) out = product(out, a);
        return out;
      }
    }
    throw new Unsupported("unsupported_operator");
  }
  return walk(parse(input)); // Parse AST only. Never compile/evaluate nodes, functions, accessors or assignments.
}
export function symbolicCompare(
  answer: string,
  reference: string,
  context: MathContext,
): { equal?: boolean; reason: string } {
  try {
    if (
      context.domain !== "real" ||
      !context.variables.length ||
      context.variables.length > 3
    )
      throw new Unsupported("unsupported_domain");
    const expr = (s: string) => polynomial(s, context);
    const equation = (s: string) => {
      const parts = s.split("=");
      if (parts.length !== 2) throw new Unsupported("equation_required");
      const p = combine(expr(parts[0]), expr(parts[1]), -1n);
      if (
        [...p.keys()].some(
          (k) => k.split(",").reduce((a, v) => a + Number(v), 0) > 1,
        )
      )
        throw new Unsupported("only_linear_equations");
      return p;
    };
    const a = context.mode === "equation" ? equation(answer) : expr(answer),
      b = context.mode === "equation" ? equation(reference) : expr(reference);
    if (context.mode === "expression")
      return {
        equal: combine(a, b, -1n).size === 0,
        reason: "exact_polynomial_identity",
      };
    if (!a.size || !b.size)
      return {
        equal: a.size === b.size,
        reason: "linear_equation_solution_set",
      };
    const first = b.entries().next().value!;
    const av = a.get(first[0]);
    if (!av) return { equal: false, reason: "linear_equation_solution_set" };
    const ratio = rat(av[0] * first[1][1], av[1] * first[1][0]);
    return {
      equal:
        combine(
          a,
          product(
            b,
            new Map([[context.variables.map(() => 0).join(","), ratio]]),
          ),
          -1n,
        ).size === 0,
      reason: "linear_equation_solution_set",
    };
  } catch (error) {
    return {
      reason:
        error instanceof Unsupported
          ? error.message
          : "unsupported_or_invalid_expression",
    };
  }
}
