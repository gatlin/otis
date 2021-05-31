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
  List,
  serialize,
  deserialize
} from "../src/operations";
import { Value, represent, atom } from "../src/value";

test("serialize", (t) => {
  let n = new NoOp();
  let n_serialized = serialize(n);

  const ins1 = new Insert(1, "o");
  const ins1_s = serialize(ins1);

  const del1 = new Delete(3, "!");
  const del1_s = serialize(del1);

  let l1 = new List([
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
  let l1_serialized = serialize(l1);

  let mv1 = new Move(1, 2, 3);
  let mv1_serialized = serialize(mv1);

  let m1 = new Map(ins1);
  let m1_serialized = serialize(m1);

  let set1 = new Set(represent("a"), represent("b"));
  let set1_serialized = serialize(set1);

  let put1 = new Put("key", represent("value"));
  let put1_serialized = serialize(put1);

  let r1 = new Rename("old", "new");
  let r1_serialized = serialize(r1);

  let rm1 = new Remove("key", represent("value"));
  let rm1_serialized = serialize(rm1);

  t.same(n_serialized, { tag: "NoOp", args: {} });
  t.same(ins1_s, {
    tag: "Splice",
    args: {
      pos: 1,
      old_value: "",
      new_value: "o"
    }
  });
  t.same(del1_s, {
    tag: "Splice",
    args: {
      pos: 3,
      old_value: "!",
      new_value: ""
    }
  });
  t.same(l1_serialized, {
    tag: "List",
    args: {
      ops: [
        {
          tag: "ArrayApply",
          args: {
            pos: 0,
            op: {
              tag: "ObjectApply",
              args: {
                key: "a",
                op: {
                  tag: "Set",
                  args: {
                    old_value: 1,
                    new_value: true
                  }
                }
              }
            }
          }
        },
        {
          tag: "ArrayApply",
          args: {
            pos: 1,
            op: {
              tag: "Put",
              args: {
                key: "b",
                value: false
              }
            }
          }
        }
      ]
    }
  });
  t.same(m1_serialized, {
    tag: "Map",
    args: {
      op: {
        tag: "Splice",
        args: {
          pos: 1,
          old_value: "",
          new_value: "o"
        }
      }
    }
  });
  t.same(mv1_serialized, {
    tag: "Move",
    args: {
      pos: 1,
      count: 2,
      new_pos: 3
    }
  });
  t.same(set1_serialized, {
    tag: "Set",
    args: {
      old_value: "a",
      new_value: "b"
    }
  });
  t.same(put1_serialized, {
    tag: "Put",
    args: {
      key: "key",
      value: "value"
    }
  });
  t.same(r1_serialized, {
    tag: "Rename",
    args: {
      old_key: "old",
      new_key: "new"
    }
  });
  t.same(rm1_serialized, {
    tag: "Remove",
    args: {
      key: "key",
      old_value: "value"
    }
  });
  t.end();
});
