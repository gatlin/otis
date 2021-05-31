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

test("values", (t) => {
  t.equal(new NoOp().apply(represent("1")), "1");
  t.equal(new Set("1","2").apply(represent("1")), "2");
  t.end();
});

test("simplify", (t) => {

  t.same(
    new NoOp().simplify(),
    new NoOp()
  );

  t.same(
    new Set(0,0).simplify(),
    new NoOp()
  );

  t.end();
});

test("invert", (t) => {
  t.same(
    new NoOp().invert(),
    new NoOp()
  );

  t.same(
    new Set(0, 1).invert(),
    new Set(1, 0)
  );

  t.end();
});

test("compose", (t) => {
  t.same(
    new NoOp().compose(new Set(1, 2)),
    new Set(1, 2)
  );

  t.same(
    new Set(1, 2).compose(new NoOp()),
    new Set(1, 2)
  );

  t.same(
    new Set(0, 1).compose(
      new Set(1, 2)
    ),
    new Set(0, 2)
  );

  t.end();
});

test("rebase", (t) => {
  let noop_rebase = new NoOp().rebase(new NoOp());
  if (null === noop_rebase) {
    throw new Error(`this should have succeeded trivially`);
  }
  t.ok(Array.isArray(noop_rebase));
  t.same(
    noop_rebase[0],
    new NoOp()
  );

  t.end();
});

