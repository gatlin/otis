otis
===

(c) 2021- Gatlin Johnson <gatlin@niltag.net>

another **o**perational **t**ransformation library for JSON values.

this is PRE-RELEASE SOFTWARE!
USE AT YOUR OWN RISK, ABANDON ALL HOPE YE WHO ENTER HERE, etc and so on.

***

this library provides:

- the type `Value` and its constructor `represent`.
  a `Value` can only be or contain *plain, simple* JSON values, eg strings and
  numbers, not `Date` objects or functions.
  
  you can use these together to essentially guarantee that you are working with
  plain values.
  it may be overkill, it's probably overkill.
  
- the type `Operation` and its concrete implementations (listed below).

- a [robot][robotfsm] state machine (`Editor`) which can be used to power an
  interactive, collaborative editing session of some kind.
  you can see an example of what the editor is currently capable of below in the
  `synopsis`.

[robotfsm]: https://thisrobot.life

Operations
---

The currently exported `Operation`s are

- `NoOp`: more of an internal utility than anything;
- `Splice`: generalization of *insertion* and *deletion*, generalized for both
   strings and arrays;
- `Insert`: convenient shorthand for a splice which deletes nothing;
- `Delete`: convenient shorthand for a splice which inserts nothing;
- `Move`: moves an array item or string character from one position to another;
- `ArrayApply`: applies an operation to a given array index;
- `Set`: sets an array item, object value, or scalar value;
- `Map`: maps an operation over an array;
- `List`: combines a sequence of multiple independent operations into one;
- `Put`: puts a value at a given index on an object;
- `Remove`: removes a given key on an object;
- `Rename`: renames a given object key;
- `ObjectApply`: applies an operation to an object.

synopsis
===

```typescript
import {
  serialize,
  ObjectApply,
  ArrayApply,
  Set,
  Rename,
  represent,
  Editor,
  create_editor
} from "otis";

const editor: Editor = create_editor("doc-1", {
  a: 3,
  c: ["cool",false]
}, () => {
  console.log(`applied edit: ${JSON.stringify(serialize(editor.context._history[0]))}`);
});

editor.send({
  type: "edit",
  operation: new Rename("a", "A"),
  base_revision: 0,
  sender_id: "sender-1"
});

editor.send({
  type: "edit",
  operation: new Rename("c", "B"),
  base_revision: 1,
  sender_id: "sender-1"
});

editor.send({
  type: "edit",
  operation: new ObjectApply("c", new ArrayApply(1, new Set(represent(false), represent(true)))),
  base_revision: 1,
  sender_id: "sender-2"
});

console.log("result", JSON.stringify(editor.context, null, 2));
```

The output of this program is

```shell
> otis@0.1.1 dev
> ts-node example.ts

applied edit: {"tag":"Rename","args":{"old_key":"a","new_key":"A"}}
applied edit: {"tag":"Rename","args":{"old_key":"c","new_key":"B"}}
applied edit: {"tag":"ObjectApply","args":{"key":"B","op":{"tag":"ArrayApply","args":{"pos":1,"op":{"tag":"Set","args":{"old_value":false,"new_value":true}}}}}}
result {
  "_id": "doc-1",
  "_body": {
    "A": 3,
    "B": [
      "cool",
      true
    ]
  },
  "_revision": 3,
  "_history": [
    {
      "key": "B",
      "op": {
        "pos": 1,
        "op": {
          "old_value": false,
          "new_value": true
        }
      }
    },
    {
      "old_key": "c",
      "new_key": "B"
    },
    {
      "old_key": "a",
      "new_key": "A"
    }
  ]
}
```
