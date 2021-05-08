import { test } from "tap";
import {
  cmp,
} from "../src/util";

test("util", (t) => {
  t.equal(cmp(1,2),-1);
  t.equal(cmp("a","z"),-1);
  t.equal(cmp([3], [1,2]), -1);
  t.equal(cmp([4,5,6],[7]), 1);

  t.end();
});
