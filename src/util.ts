/* eslint-disable */
// Simplifies, adapts, documents, and extends the following work:
// https://github.com/pelotom/hkts

/**
 * `$` solves a weird problem in what might be a weird way, so it's helpful to
 * separate what those are.
 *
 * THE PROBLEM IT SOLVES: in typescript, a type variable introduced by a
 * generic can't itself be generic. Eg,
 *
 *   type Foo<T,A> = T<A>;
 *
 * is not legal because T is not generic.
 *
 * Instead, we can use $<T,A> ~ T<A>.
 *
 * HOW IT SOLVES IT: conditional typing is (ab)used to construct an indexed type
 * wrapping the type application result (whatever it may be), which is then
 * immediately indexed. This part I leave for you to explore.
 */
// prettier-ignore
type $<T, S extends any> = (
  T extends Fix<infer U> ? { [indirect]: U } :
  T extends _ ? { [indirect]: S } :
  T extends undefined | null | boolean | string | number ? { [indirect]: T } :
  T extends (...x: infer I) => infer O ? { [indirect]: (...x: $<I, S>) => $<O, S> } :
  T extends Record<string,unknown> ? { [indirect]: { [K in keyof T]: $<T[K], S> } } :
  { [indirect]: never }
)[typeof indirect];

/**
 * Used as a level of indirection to avoid circularity errors.
 */
declare const indirect: unique symbol;

/**
 * Placeholder representing an indexed type variable.
 */
interface _<N extends number = 0> {
  [index]: N;
}
declare const index: unique symbol;

/**
 * Marks a type to be ignored by the application operator `$`. This is used to protect
 * bound type parameters.
 * In combination with the functions `_in` and `out` this also serves to
 * construct type-level fixpoint terms with no runtime penalty.
 */
interface Fix<T> {
  [fixed]: T;
}
declare const fixed: unique symbol;
const _in = <F>(term: $<F,Fix<F>>): Fix<F> => (<Fix<F>>term);
const out = <F>(term: Fix<F>): $<F,Fix<F>> => (<$<F,Fix<F>>>term);

interface Functor<T> {
  map: <A, B>(
    f: (x: A) => B,
    t: $<T, A>
  ) => $<T, B>; }

// An f-algebra reduces functor values parameterized by a given carrier type
// "A" to that particular type.
type Algebra<F,A> = (fa: $<F,A>) => A;

/**
 * Produces "catamorphisms" (ie, evaluators / reducers / folds) for algebraic
 * functor types from a given functor algebra.
 */
function cata<F,A>(
  functor: Functor<F>,
  transformer: Algebra<F,A>,
  term: Fix<F>
): A {
  const extracted = out(term);
  const children_mapped = functor.map(
    v => cata(functor, transformer, v),
    extracted );
  const transformed = transformer(children_mapped);
  return transformed; }

const type_name = <T>(x: T | Array<unknown>): string => {
  if (null === x) { return "null"; }
  return ("object" === typeof x)
    ? Array.isArray(x)
      ? "array"
      : "object"
    : typeof x;
};

const cmp = <A,B>(a: A, b: B): number => {
  if (type_name(a) !== type_name(b)) {
    return cmp(type_name(a), type_name(b));
  }

  else if ("number" === typeof a && "number" === typeof b) {
    if (a < b) { return -1; }
    if (a > b) { return 1 }
    return 0;
  }

  else if ("string" === typeof a && "string" === typeof b) {
    return a.localeCompare(b);
  }

  else if (Array.isArray(a) && Array.isArray(b)) {
    let x = cmp(a.length, b.length);
    if (0 !== x) { return x; }
    for (let i = 0; i < a.length; i++) {
      x = cmp(a[i], b[i]);
      if (0 !== x) { return x; }
    }
    return 0;
  }

  throw new Error(`Type ${type_name(a)} not comparable.`);
};

export {
  _,
  Algebra,
  Fix,
  Functor,
  cata,
  _in,
  out,
  type_name,
  cmp
};