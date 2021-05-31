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

test("deserialize", (t) => {
  let noop = deserialize({ tag: "NoOp", args: {} });
  let ins1 = deserialize({
    tag: "Splice",
    args: {
      pos: 1,
      old_value: "",
      new_value: "o"
    }
  });
  let del1 = deserialize({
    tag: "Splice",
    args: {
      pos: 3,
      old_value: "!",
      new_value: ""
    }
  });
  let list1 = deserialize({
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
  let map1 = deserialize({
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
  let rm1 = deserialize({
    tag: "Remove",
    args: {
      key: "key",
      old_value: "value"
    }
  });
  let r1 = deserialize({
    tag: "Rename",
    args: {
      old_value: "old",
      new_value: "new"
    }
  });
  let put1 = deserialize({
    tag: "Put",
    args: {
      key: "key",
      value: "value"
    }
  });
  let set1 = deserialize({
    tag: "Set",
    args: {
      old_value: "old",
      new_value: "new"
    }
  });
  let mv1 = deserialize({
    tag: "Move",
    args: {
      pos: 0,
      count: 1,
      new_pos: 2
    }
  });
  t.same(noop, new NoOp());
  t.same(ins1, new Splice(1, "", "o"));
  t.same(del1, new Splice(3, "!", ""));
  t.same(list1, new List([
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
  ]).simplify());
  t.same(map1, new Map(new Splice(1, "", "o")));
  t.same(rm1, new Remove("key", represent("value")));
  t.same(r1, new Rename("old", "new"));
  t.same(put1, new Put("key", represent("value")));
  t.same(set1, new Set(represent("old"), represent("new")));
  t.same(mv1, new Move(0, 1, 2));
  t.end();
});
