import { _in, cata } from "./util";
import type { _, Algebra, Fix, Functor } from "./util";

type Atom = string | number | boolean | null;
type Obj<A> = { [key: string]: A };
type Arr<A> = { [idx: number]: A };
type ValueF<A> = Atom | Obj<A> | Arr<A>;

type Value = Fix<ValueF<_>>;
const atom = (a: Atom): Value => _in(a);
const obj = (o: { [key: string]: Value }): Value => _in(o);
const arr = (a: { [idx: number]: Value }): Value => _in(a);

const ValueFunctor: Functor<ValueF<_>> = {
  map: <A, B>(f: (x: A) => B, val: ValueF<A>) => {
    if ("object" === typeof val) {
      if (null === val) {
        return null;
      }
      else if (Array.isArray(val)) {
        return val.map((v) => f(v));
      }
      else {
        const mutated: { [key: string]: B } = {};
        for (const [k, v] of Object.entries(val as { [key: string]: A })) {
          const r: B = f(v);
          mutated[k] = r;
        }
        return mutated;
      }
    }
    else {
      return val;
    }
  }
};

const ValueJsonAlg: Algebra<ValueF<string>, string> = (val) => {
  if ("object" === typeof val) {
    if (null === val) {
      return "null";
    }
    else if (Array.isArray(val)) {
      return `[${val.join(",")}]`;
    }
    else {
      const kvs = [];
      for (const [k, v] of Object.entries(
        val as { [key: string]: ValueF<_> }
      )) {
        kvs.push(`"${k}":${v}`);
      }
      return `{${kvs.join(",")}}`;
    }
  }
  else {
    return JSON.stringify(val, null, 2);
  }
};
const value_to_json = (val: Value): string =>
  cata(ValueFunctor, ValueJsonAlg, val);

const represent = (datum: unknown): Value => {
  if ("object" === typeof datum) {
    if (null === datum) {
      return atom(null);
    }
    else if (Array.isArray(datum)) {
      return arr(datum.map(represent));
    }
    else {
      const mutated: { [key: string]: Value } = {};
      for (const [k, v] of Object.entries(
        datum as { [key: string]: unknown }
      )) {
        mutated[k] = represent(v);
      }
      return obj(mutated);
    }
  }
  else {
    switch (typeof datum) {
      case "string":
      case "number":
      case "boolean":
        return atom(datum as Atom);
      default:
        break;
    }
  }
  throw new Error(`Cannot build representation of ${datum}`);
};

const json_to_value = (jsons: string): Value => represent(JSON.parse(jsons));

export type { Value, Arr, Atom, Obj };

export { atom, obj, arr, value_to_json, json_to_value, represent };
