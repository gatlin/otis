import { test } from "tap";
import {
  Splice,
  Insert,
  Delete,
  NoOp,
  Move,
  ArrayApply,
  Map,
  Put,
  Remove,
  Set,
  Rename,
  ObjectApply,
  List
} from "../src/operations";
import { Value, represent, atom } from "../src/value";

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

  const m1 = new Move(0,1,2);
  const rm1 = ins1.rebase(m1);
  if (!rm1) { throw new Error("error testing insert.rebase(move)"); }

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
  const sp1 = new Splice(3, "123", "456");
  const sp2 = new Splice(4, "2", "ABC");
  const r3 = sp1.rebase(sp2);
  if (!r3) { throw new Error("error in third splice rebase"); }

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

  t.same(rm1[0], new Splice(0, "", "o"));
  t.same(rm1[1], m1);

  t.same(r3[0], new Splice(3, "1ABC3", "456"));
  t.same(r3[1], new NoOp());

  t.end();
});

test("move - strings", (t) => {
  const v1: Value = represent("albatross");
  const m1 = new Move(0, 1, 2);
  const m2 = new Move(0, 2, 5);
  const v2: Value = represent("123");
  const m3 = new Move(0, 1, 3);
  const m4 = new Move(2, 1, 0);

  t.same(m1.apply(v1), "labatross");
  t.same(m2.apply(v1), "batalross");
  t.same(m3.apply(v2), "231");
  t.same(m4.apply(v2), "312");
  t.end();
});

test("move - arrays", (t) => {
  const v: Value = represent([1,2,3,4,5,6]);
  const m1 = new Move(0,1,2);
  const m2 = new Move(0,2,5);
  const m3 = new Move(3,1,0);
  const m4 = m3.compose(m1);
  if (!m4) { throw new Error("error composing move (arrays) "); }

  t.same(m4, new Move(3,2,1));
  t.same(m1.apply(v), [2,1,3,4,5,6]);
  t.same(m2.apply(v), [3,4,5,1,2,6]);
  t.same(m3.apply(v), [4,1,2,3,5,6]);
  t.same(m4.apply(v),[1,4,5,2,3,6]);
  t.end();
});

test("array apply", (t) => {
  const v: Value = represent(["hello","smurf","otis"]);
  const ap1 = new ArrayApply(0,new Insert(5, "!"));
  const m1 = new Move(1,1,0);
  const r1 = m1.rebase(ap1);
  if (!r1) { throw new Error("error composing move.arrayapply"); }

  t.same(ap1.apply(v),["hello!","smurf","otis"]);
  t.same(m1.apply(v), ["smurf","hello","otis"]);
  t.same(r1[0], m1);
  t.same(r1[1], new ArrayApply(1, new Insert(5, "!")));
  t.same(r1[1].apply(m1.apply(v)), ["smurf","hello!","otis"]);
  t.end();
});

test("map", (t) => {
  const v: Value = represent(["hello", "smurf","otis"]);
  const m1 = new Map(new Insert(0, "> "));
  t.same(m1.apply(v), ["> hello", "> smurf", "> otis"]);
  t.end();
});

test("put", (t) => {
  const v: Value = represent({ a: 1 });
  const p1 = new Put("b", represent(2));
  t.same(p1.apply(v), { a: 1, b: 2});
  t.end();
});

test("remove", (t) => {
  const v: Value = represent({ a: 1, b: 2 });
  const r1 = new Remove("b", represent(2));
  t.same(r1.apply(v), { a: 1 });
  t.end();
});

test("set", (t) => {
  const v: Value = represent({ a: 1 });
  const s = new ObjectApply("a", new Set(atom(1),atom("cool")));
  t.same(s.apply(v), { a: "cool" });
  t.end();
});

test("rename", (t) => {
  const v: Value = represent({ a: 1, b: 2 });
  const r1 = new Rename("b", "c");
  t.same(r1.apply(v), { a: 1 , c: 2});
  t.end();
});

test("object apply", (t) => {
  const v: Value = represent({ a: "hello" });
  const ap = new ObjectApply("a", new Insert(5, ", world!"));
  t.same(ap.apply(v), { a: "hello, world!"});
  t.end();
});

test("list", (t) => {
  const v: Value = represent([ { a: 1 }, { a: 2 } ]);
  const op = new List([
    new ArrayApply(
      0,
      new ObjectApply(
        "a",
        new Set(1, atom(true))
      )
    ),
    new ArrayApply(
      1,
      new Put("b", atom(false))
    )
  ]).simplify();
  t.same(op.apply(v), [
    { a: true },
    { a: 2, b: false }
  ]);
  t.end();
});

test("misc", (t) => {
  const v: Value = represent({
    url: "https://niltag.net/example-service",
    method: "PATCH",
    Headers: {
      "Content-Type": "application/Json",
      "The-CORS-Header": "*"
    },
    body: JSON.stringify([1, 2, 3])
  });
  const op1 = new ObjectApply("method", new Set("PATCH", "POST"));
  t.same(op1.apply(v), {
    url: "https://niltag.net/example-service",
    method: "POST",
    Headers: {
      "Content-Type": "application/Json",
      "The-CORS-Header": "*"
    },
    body: JSON.stringify([1, 2, 3])
  });

  const op2 = new ObjectApply(
    "Headers",
    new ObjectApply(
      "Content-Type",
      new Set("application/Json", "application/json")
    )
  );
  t.same(op2.apply(v), {
    url: "https://niltag.net/example-service",
    method: "PATCH",
    Headers: {
      "Content-Type": "application/json",
      "The-CORS-Header": "*"
    },
    body: JSON.stringify([1, 2, 3])
  });

  const op3 = new Rename("Headers", "headers");
  t.same(op3.apply(v), {
    url: "https://niltag.net/example-service",
    method: "PATCH",
    headers: {
      "Content-Type": "application/Json",
      "The-CORS-Header": "*"
    },
    body: JSON.stringify([1, 2, 3])
  });

  const r1 = op3.rebase(op2);
  if (!r1) { throw new Error("error in misc rebase 1"); }
  t.same(r1[0], new Rename("Headers", "headers"));
  t.same(r1[1], new ObjectApply(
    "headers",
    new ObjectApply(
      "Content-Type",
      new Set("application/Json", "application/json")
    )
  ));
  t.end();
});
