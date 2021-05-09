import { test } from "tap";
import {
  Splice,
  Insert,
  Delete,
  NoOp,
  Move
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

  t.same(n, n.simplify());
  t.same(n, n.compose(n));
  t.end();
});

test("splice - strings", (t) => {
  const v: Value = represent("gat!");
  const ins1 = new Insert(1, "o");
  const del1 = new Delete(3, "!");

  const insa = new Insert(1, "a");
  const insb = new Insert(2, "b");
  const insab = new Insert(1, "ab");

  const ins_inverted = ins1.invert().compose(ins1);
  if (!ins_inverted) {
    throw new Error("error composing inverse splices in test");
  }

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

  t.same(ins1.compose(new NoOp()), ins1);
  t.same(new NoOp().compose(ins1), ins1);
  t.same(insab, insa.compose(insb));

  t.same(new NoOp(), ins_inverted.simplify());

  t.same(
    new Delete(0, "ab").compose(
      new Insert(0, "abc")
    ),
    new Splice(
      0,
      "ab",
      "abc"
    ).simplify()
  );

  t.end();
});

test("move - strings", (t) => {
  const v: Value = represent("albatross");
  const m1 = new Move(0, 1, 2);
  t.same(m1.apply(v), "labatross");
  t.end();
});

test("move - arrays", (t) => {
  const v: Value = represent([1,2,3,4,5,6]);
  const m1 = new Move(0,1,2);
  t.same(m1.apply(v), [2,1,3,4,5,6]);
  t.end();
});
