import { test } from "tap";
import {
  Splice,
  Insert,
  Delete,
  NoOp
} from "../src/operations";
import { Value, represent } from "../src/value";

test("noop", (t) => {
  let n = new NoOp();
  let r = (new NoOp()).rebase(new NoOp());
  if (!r) {
    throw new Error("error in noop rebase");
  }
  t.ok(Array.isArray(r));
  t.equal(r.length, 2);
  t.same(r[0], new NoOp());
  t.same(r[1], new NoOp());
  t.same(n, n.invert());
  t.end();
});

test("splice", (t) => {
  const v: Value = represent("gat!");
  const ins1 = new Insert(1, "o");
  const del1 = new Delete(3, "!");
  const r1 = del1.rebase(ins1);
  if (!r1) {
    throw new Error("error in first splice rebase");
  }
  const r2 = ins1.rebase(del1);
  if (!r2) {
    throw new Error("error in second splice rebase");
  }
  t.ok(ins1 instanceof Splice);
  t.ok(del1 instanceof Splice);

  t.same(ins1.invert(), new Splice(1, "o", ""));
  t.same(del1.invert(), new Splice(3, "", "!"));

  t.equal(v, ins1.invert().apply(ins1.apply(v)));
  t.equal(v, del1.invert().apply(del1.apply(v)));


  t.equal("goat!", ins1.apply(v));
  t.equal("gat", del1.apply(v));

  t.ok(Array.isArray(r1));
  t.equal(r1.length, 2);

  t.same(r1[0], new Delete(3, "!"));
  t.same(r1[1], new Insert(1, "o"));

  t.equal("goat", r1[1].apply(r1[0].apply(v)));

  t.ok(Array.isArray(r2));
  t.equal(r2.length, 2);

  t.same(r2[0], new Insert(1, "o"));
  t.same(r2[1], new Delete(4, "!"));

  t.equal("goat", r2[1].apply(r2[0].apply(v)));
  t.end();
});

