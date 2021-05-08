import { test } from "tap";
import {
  Value,
  represent,
  value_to_json,
  json_to_value
} from "../src/value";

test("value", (t) => {
  const s: string = "test string";
  const v1: Value = represent(s);
  t.same(s,v1);

  const o1: { [_:string]: any } = {
    a: [ 1, "b", true ],
    b: null,
    c: {
      d: [false, [true]]
    }
  };
  const v2: Value = represent(o1);
  t.same(o1,v2);

  const v2_str = value_to_json(v2);
  t.same(v2, json_to_value(v2_str));
  t.end();
});
