import {
  Value,
  arr,
  obj,
  atom,
  represent
} from "./value";

import { cmp, out, concat3, concat4, map_index, elem, unelem, shallow_clone } from "./util";
import deepEqual from "deep-equal";

interface Operation {
  apply(value: Value): Value;
  rebase(other: Operation): [Operation,Operation] | null;
  invert(): Operation;
  compose(other: Operation): Operation | null;
  simplify(): Operation;
}

// eslint-disable-next-line
function serialize(op: Operation): { tag: string, args: any } {
  let tag: string = op.constructor.name;
  let args = out(represent(op)) as { [key:string]: unknown };
  if (op instanceof Insert || op instanceof Delete)
  { tag = "Splice"; }
  else if (op instanceof List)
  { args = { ...args, ops: op.ops.map(serialize) }; }
  else if ( op instanceof ArrayApply ||
    op instanceof ObjectApply ||
    op instanceof Map )
  { args = { ...args, op: serialize(op.op) }; }
  return { tag, args };
}

// eslint-disable-next-line
function deserialize(value: { tag: string, args: any }): Operation {
  const { tag, args } = value;
  switch (tag) {
  case "NoOp": return new NoOp();
  case "Splice": return new Splice(args.pos,args.old_value,args.new_value);
  case "List": return new List(args.ops.map(deserialize));
  case "Move": return new Move(args.pos, args.count, args.new_pos);
  case "Set": return new Set(args.old_value, args.new_value);
  case "Put": return new Put(args.key, args.value);
  case "Map": return new Map(deserialize(args.op));
  case "Remove": return new Remove(args.key, args.old_value);
  case "Rename": return new Rename(args.old_value, args.new_value);
  case "ArrayApply": return new ArrayApply(args.pos, deserialize(args.op));
  case "ObjectApply": return new ObjectApply(args.key, deserialize(args.op));
  default: throw new Error(`Invalid serialized operation: ${value}`);
  }
}

class NoOp implements Operation {
  public apply(value: Value): Value {
    return value;
  }

  public invert(): Operation {
    return this;
  }

  public compose(other: Operation): Operation | null {
    return other;
  }

  public simplify(): Operation {
    return this;
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) {
      return [new NoOp(), new NoOp()];
    }
    return [this, other];
  }
}

class List implements Operation {
  constructor(
    public readonly ops: Operation[]
  ) {}

  public apply(value: Value): Value {
    let __value: unknown = out(value);
    let _value: string | Value[] = __value as (string | Value[]);
    for (let i = 0; i < this.ops.length; i++) {
      __value = out(this.ops[i].apply(represent(_value)));
      _value = __value as (string | Value[]);
    }
    return represent(_value);
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    return other.rebase(this);
  }

  public invert(): Operation {
    const new_ops = [];
    for (let i = this.ops.length - 1; i >= 0; i--) {
      new_ops.push(this.ops[i].invert());
    }
    return new List(new_ops);
  }

  public compose(other: Operation): Operation | null {
    if (0 === this.ops.length) {
      return other;
    }
    if (other instanceof NoOp) {
      return this;
    }
    if (other instanceof Set) {
      return other.simplify();
    }
    if (other instanceof List) {
      if (0 === other.ops.length) {
        return this;
      }
      return new List(this.ops.concat(other.ops));
    }
    const new_ops = this.ops.slice();
    new_ops.push(other);
    return new List(new_ops);
  }

  public simplify(): Operation {
    if (0 === this.ops.length) {
      return new NoOp();
    }
    const new_ops: Operation[] = [];
    for (let i = 0; i < this.ops.length; i++) {
      let op: Operation = this.ops[i];
      if (op instanceof NoOp) {
        continue;
      }

      if (0 === new_ops.length) {
        new_ops.push(op);
      }
      else {
        for (let j = new_ops.length - 1; j >= 0; j--) {
          const c = new_ops[j].compose(op);
          if (c) {
            if (c instanceof NoOp) {
              new_ops.splice(j, 1);
            }
            else {
              new_ops[j] = c;
            }
          }
          else {
            if (j > 0) {
              const r1 = op.rebase(new_ops[j].invert());
              const r2 = new_ops[j].rebase(op);
              if (null !== r1 && null !== r2) {
                op = r1[0];
                new_ops[j] = r2[1];
                continue;
              }
            }
            new_ops.splice(j + 1, 0, op);
            break;
          }
        }
      }
    }
    if (0 === new_ops.length) {
      return new NoOp();
    }
    if (1 === new_ops.length) {
      return new_ops[0];
    }
    return new List(new_ops);
  }
}

class Splice implements Operation {
  public readonly old_value: string | Value[];
  public readonly new_value: string | Value[];
  constructor(
    public readonly pos: number,
    old_value: string | Value[],
    new_value: string | Value[]
  ) {
    if ((typeof old_value) !== (typeof new_value))
    { throw new Error("values must be the same type"); }
    if (!Array.isArray(old_value) && ("string" !== typeof old_value))
    { throw new Error(`invalid value: ${old_value}`); }
    this.old_value = old_value;
    if (!Array.isArray(new_value) && ("string" !== typeof new_value))
    { throw new Error(`invalid value: ${new_value}`); }
    this.new_value = new_value;
    if (!(this instanceof Splice)) {
      return new Splice(pos, old_value, new_value);
    }
  }

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: string | Value[] = __value as (string | Value[]);
    const item1: typeof _value = (_value.slice(0,this.pos));
    const item3: typeof _value = (_value.slice(this.pos + this.old_value.length));
    const catted: typeof item3 = concat3(item1, this.new_value, item3);
    return ("string" === typeof catted ? atom(catted) : arr(catted));
  }

  public invert(): Operation {
    return new Splice(
      this.pos,
      this.new_value,
      this.old_value
    );
  }

  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) {
      return this;
    }
    if (other instanceof Splice) {
      if (this.pos <= other.pos
        && other.pos + other.old_value.length <=
        this.pos + this.new_value.length) {
        const item1 : string | Value[] = this.new_value.slice(0, other.pos - this.pos);
        const item2 : typeof item1 = other.new_value;
        const item3 : typeof item2 = this.new_value.slice(
          this.new_value.length +
            (other.pos + other.old_value.length) -
            (this.pos + this.new_value.length)
        );
        const catted: typeof item3 = concat3(item1, item2, item3);
        return new Splice(
          this.pos,
          this.old_value,
          catted
        );
      }

      if (other.pos <= this.pos
        && this.pos + this.new_value.length <=
        other.pos + other.old_value.length) {
        const item1 : string | Value[] = other.old_value.slice(0, this.pos - other.pos);
        const item2 : typeof item1  = other.old_value;
        const item3 : typeof item2  = other.old_value.slice(
          other.old_value.length + (this.pos + this.new_value.length) - (other.pos + other.old_value.length));
        const catted: typeof item3 = concat3(item1, item2, item3);
        return new Splice(
          other.pos,
          catted,
          other.new_value
        );
      }
    }
    if (other instanceof Set) {
      return new Set(
        this.invert().apply(other.old_value),
        other.new_value
      ).simplify();
    }
    if (other instanceof ArrayApply) {
      if (other.pos >= this.pos && other.pos < this.pos + this.old_value.length) {
        return new Splice(
          this.pos,
          this.old_value,
          concat3(
            (this.new_value as string | Value[]).slice(0,other.pos - this.pos),
            unelem(
              other.apply(elem(this.new_value, other.pos - this.pos)),
              this.old_value
            ),
            this.new_value.slice(other.pos - this.pos + 1)
          )
        ).simplify();
      }
    }
    return null;
  }

  public simplify(): Operation {
    if (deepEqual(this.old_value, this.new_value)) {
      return new NoOp();
    }
    return this;
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) { return [this, other]; }
    if (other instanceof Splice) {
      return this.rebase_splice(other);
    }
    if (other instanceof Move) {
      return this.rebase_move(other);
    }
    if (other instanceof ArrayApply) {
      return this.rebase_arrayapply(other);
    }
    if (other instanceof Map) {
      return this.rebase_map(other);
    }
    if (other instanceof NoOp) { return [this,other]; }
    return null;
  }

  private rebase_map(other: Map): [Operation,Operation] | null {
    try {
      const __old_value: unknown = out(other.apply(represent(this.old_value)));
      const _old_value : string | Value[] = __old_value as (string | Value[]);
      const __new_value: unknown = out(other.apply(represent(this.new_value)));
      const _new_value : string | Value[] = __new_value as (string | Value[]);
      return [
        new Splice(
          this.pos,
          _old_value,
          _new_value
        ),
        other
      ];
    }
    catch (err) {
      const __old_value: unknown = out(other.apply(represent(this.old_value)));
      const _old_value : string | Value[] = __old_value as (string | Value[]);
      return [
        new Splice(
          this.pos,
          _old_value,
          this.new_value
        ),
        new NoOp()
      ];
    }
    return null;
  }

  private rebase_arrayapply(other: ArrayApply): [Operation,Operation] | null {
    if (other.pos >= this.pos + this.old_value.length) {
      return [
        this,
        new ArrayApply(
          other.pos + this.new_value.length - this.old_value.length,
          other.op
        )
      ];
    }

    if (other.pos < this.pos) {
      return [this, other];
    }

    const old_value = concat3(
      this.old_value.slice(0, other.pos - this.pos),
      unelem(other.op.apply(
        elem(this.old_value, other.pos - this.pos)), this.old_value),
      this.old_value.slice(other.pos - this.pos + 1)
    );

    if (this.new_value.length === this.old_value.length) {
      const new_value = concat3(
        this.new_value.slice(0, other.pos - this.pos),
        unelem(other.op.apply(elem(this.new_value,other.pos - this.pos)),this.old_value),
        this.new_value.slice(other.pos - this.pos + 1)
      );
      return [
        new Splice(this.pos, old_value, new_value),
        other
      ];
    }
    return [
      new Splice(this.pos, old_value, this.new_value),
      new NoOp()
    ];
  }

  private rebase_move(other: Move): [Operation,Operation] | null {
    if (this.pos + this.old_value.length < other.pos) {
      return [
        new Splice(
          map_index(this.pos, other),
          this.old_value,
          this.new_value
        ),
        new Move(
          other.pos + this.new_value.length - this.old_value.length,
          other.count,
          other.new_pos
        )
      ];
    }

    if (this.pos >= other.pos + other.count) {
      return [
        new Splice(
          map_index(this.pos, other),
          this.old_value,
          this.new_value
        ),
        other
      ];
    }
    return null;
  }

  private rebase_splice(other: Splice): [Operation,Operation] | null {
    if (deepEqual(this,other))
    { return [new NoOp(), new NoOp()]; }
    // both inserts
    if (this.pos === other.pos
     && 0 === this.old_value.length
     && 0 === other.old_value.length
    ) {
      if (cmp(this.new_value, other.new_value) < 0) {
        // Do nothing to us,
        // punt other forward by (this.new_value.length) positions.
        return [this, new Splice(
          other.pos + this.new_value.length,
          other.old_value,
          other.new_value
        )];
      }
      return null;
    }

    // splicing at same position and we delete the same amount
    else if ( this.pos === other.pos
           && this.old_value.length === other.old_value.length
    ) {
      if (cmp(this.new_value, other.new_value) < 0) {
        // merge them into one super delete
        return [
          new NoOp(),
          new Splice(
            other.pos,
            this.new_value,
            other.new_value
          )];
      }
      return null;
    }

    else if (this.pos + this.old_value.length <= other.pos) {
      // Do nothing to us,
      // punt them forward beyond where we have done our work.
      return [
        this,
        new Splice(
          other.pos + (this.new_value.length - this.old_value.length),
          other.old_value,
          other.new_value
        )
      ];
    }

    // overlapping splices
    else if (
      ((this.pos < other.pos) || (this.pos === other.pos &&
           this.old_value.length >
           other.old_value.length))
    && ((this.pos + this.old_value.length > other.pos +
        other.old_value.length)
        || ((this.pos + this.old_value.length === other.pos +
            other.old_value.length) && this.pos < other.pos))
    ) {
      const _ov = this.old_value;
      const item1: typeof _ov = this.old_value.slice(
        0,
        other.pos - this.pos
      );
      const item3: typeof item1 = this.old_value.slice(
        other.pos + other.old_value.length -
          this.pos);
      const catted: typeof item3 = concat3(
        item1,
        other.new_value,
        item3
      );
      // we absorb their splice into ours
      return [
        new Splice(
          this.pos,
          catted,
          this.new_value
        ),
        new NoOp()
      ];
    }
    // we precede them but the other cases don't apply
    else if (this.pos < other.pos) {
      return [
        new Splice(
          this.pos,
          this.old_value.slice(0,other.pos - this.pos),
          this.new_value
        ),
        new Splice(
          this.pos + this.new_value.length,
          other.old_value.slice(
            this.pos +
            this.old_value.length - other.pos),
          other.new_value
        )
      ];
    }
    // they precede us
    else {
      return [this,other];
    }
    return null;
  }
}

class Insert extends Splice {
  constructor(
    pos: number,
    value: string | Value[]
  ) {
    super( pos, value.slice(0,0), value );
    if (!(this instanceof Insert)) {
      return new Insert(pos, value);
    }
  }
}

class Delete extends Splice {
  constructor(
    pos: number,
    old_value: string | Value[]
  ) {
    super( pos, old_value, old_value.slice(0,0) );
    if (!(this instanceof Delete)) {
      return new Delete(pos, old_value);
    }
  }
}

class Move implements Operation {
  constructor(
    public readonly pos: number,
    public readonly count: number,
    public readonly new_pos: number
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: string | Value[] = __value as (string | Value[]);
    if (null === _value) { throw new Error ("shut up"); }
    if (this.pos < this.new_pos) {
      const item1 : string | Value[] = _value.slice(0, this.pos);
      const item2 : typeof item1 = _value.slice(this.pos + this.count, this.new_pos);
      const item3_a : typeof item2 = _value.slice(this.pos, this.pos + this.count);
      const item3_b : typeof item3_a = _value.slice(this.new_pos);
      const catted: typeof item1 = concat4(item1,item2,item3_a,item3_b);
      return ("string" === typeof catted ? atom(catted) : arr(catted));
    }
    else {
      const item1: string | Value[] = _value.slice(0, this.new_pos);
      const item2: typeof item1 = _value.slice(this.pos, this.pos + this.count);
      const item3: typeof item2 = _value.slice(this.new_pos, this.pos);
      const item4: typeof item3 = _value.slice(this.pos + this.count);
      const catted: typeof item1 = concat4(item1,item2,item3,item4);
      return ("string" === typeof catted ? atom(catted) : arr(catted));
    }
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) {
      return [this,other];
    }
    if (other instanceof Move) {
      if (this.pos + this.count >= other.pos
        && this.pos < other.pos + other.count) {
        return null;
      }
      return [
        new Move(
          map_index(this.pos, other),
          this.count,
          map_index(this.new_pos, other)
        ),
        new NoOp()
      ];
    }
    if (other instanceof ArrayApply) {
      return [
        this,
        new ArrayApply(map_index(other.pos, this), other.op)
      ];
    }
    if (other instanceof Map) {
      return [ this, other ];
    }
    return null;
  }

  public invert(): Operation {
    if (this.new_pos > this.pos) {
      return new Move(
        this.new_pos - this.count,
        this.count,
        this.pos
      );
    }
    else {
      return new Move(
        this.new_pos,
        this.count,
        this.pos + this.count
      );
    }
  }

  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) {
      return this;
    }
    if (other instanceof Splice) {
      if (this.new_pos === other.pos
        && this.count === other.old_value.length
        && 0 === other.new_value.length) {
        return new Delete(this.pos, other.old_value);
      }
    }
    if (other instanceof Move) {
      if (this.new_pos === other.pos && this.count === other.count) {
        return new Move(
          this.pos,
          other.new_pos,
          this.count
        );
      }
    }
    return null;
  }

  public simplify(): Operation {
    if (this.pos === this.new_pos) {
      return new NoOp();
    }
    return this;
  }
}

class Set implements Operation {
  public readonly old_value: Value;
  public readonly new_value: Value;
  constructor(
    old_value: unknown,
    new_value?: unknown
  ) {
    this.old_value = represent(old_value);
    if (new_value) {
      this.new_value = represent(new_value);
    }
  }

  // eslint-disable-next-line
  public apply(value: Value): Value {
    return this.new_value as Value;
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) { return [this,other]; }
    if (other instanceof Set) {
      if (deepEqual(this.new_value, other.new_value)) {
        return [new NoOp(), new NoOp()];
      }

      if (cmp(this.new_value,other.new_value) < 0) {
        return [
          new NoOp(),
          new Set(
            this.new_value as Value,
            other.new_value
          )
        ];
      }
    }
    return null;
  }

  public compose(other: Operation): Operation | null {
    return new Set(
      this.old_value,
      other.apply(this.new_value as Value)
    ).simplify();
  }

  public invert(): Operation {
    return new Set(this.new_value as Value, this.old_value);
  }

  public simplify(): Operation {
    if (deepEqual(this.old_value, this.new_value)) {
      return new NoOp();
    }
    return this;
  }
}

class ArrayApply implements Operation {
  constructor(
    public readonly pos: number,
    public readonly op: Operation
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: string | Value[] = __value as (string | Value[]);
    return concat3(
      _value.slice(0, this.pos),
      unelem((this.op as Operation).apply(elem(_value, this.pos)), _value),
      _value.slice(this.pos+1, _value.length)
    );
  }
  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) {
      return [this,other];
    }
    if (other instanceof ArrayApply) {
      if (other.pos !== this.pos) {
        return [this, other];
      }
      const opa = this.op.rebase(other.op);
      const opb = other.op.rebase(this.op);
      if (opa && opb) {
        return [
          (opa instanceof NoOp)
            ? new NoOp()
            : new ArrayApply(this.pos, opa[0]),
          (opb instanceof NoOp)
            ? new NoOp()
            : new ArrayApply(other.pos, opb[1])
        ];
      }
    }
    if (other instanceof Map) {
      const opa = this.op.rebase(other.op);
      if (!opa) {
        return null;
      }
      const r = (opa instanceof NoOp)
        ? new NoOp()
        : new ArrayApply(this.pos, opa[0]);
      const opb = other.op.rebase(this.op);
      if(opa && opb && deepEqual(opa[0],opb[1])) {
        return [r, other];
      }
      else {
        return [
          r,
          new List([
            this.invert(),
            other,
            r
          ]).simplify()
        ];
      }
    }
    return null;
  }
  public invert(): Operation {
    return new ArrayApply(
      this.pos,
      this.op.invert()
    );
  }
  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) {
      return this;
    }
    if (other instanceof Splice) {
      if (this.pos >= other.pos
        && this.pos < other.pos + other.old_value.length) {
        return new Splice(
          other.pos,
          concat3(
            other.old_value.slice(0, this.pos - other.pos),
            unelem(this.invert().apply(elem(
              other.old_value, this.pos - other.pos)),
            other.old_value),
            other.old_value.slice(this.pos - other.pos + 1)),
          other.new_value
        ).simplify();
      }
    }
    if (other instanceof ArrayApply) {
      if (this.pos === other.pos) {
        const op2 = this.op.compose(other.op);
        if (op2) {
          return new ArrayApply(this.pos, op2);
        }
      }
    }
    return null;
  }
  public simplify(): Operation {
    const op = this.op.simplify();
    if (op instanceof NoOp) {
      return new NoOp();
    }
    return this;
  }
}

class Map implements Operation {
  constructor(
    public readonly op: Operation
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: string | Value[] = __value as (string | Value[]);
    const d: Value[] = ("string" === typeof _value)
      ? _value.split(/.{0}/).map(atom) as Value[]
      : _value.slice();
    for (let i = 0; i < d.length; i++) {
      d[i] = this.op.apply(d[i]);
    }
    return ("string" === typeof _value)
      ? atom(d.join(""))
      : arr(d);
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) { return [this,other]; }
    if (other instanceof Map) {
      const opa = this.op.rebase(other.op);
      const opb = other.op.rebase(this.op);
      if (opa && opb) {
        return [
          (opa instanceof NoOp) ? new NoOp() : new Map(opa[0]),
          (opb instanceof NoOp) ? new NoOp() : new Map(opb[1])
        ];
      }
    }
    return null;
  }
  public invert(): Operation {
    return new Map(this.op.invert());
  }
  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) { return this; }
    if (other instanceof Set) {
      return new Set(
        this.invert().apply(other.old_value),
        other.new_value
      ).simplify();
    }
    if (other instanceof Map) {
      const op2 = this.op.compose(other.op);
      if (op2) {
        return new Map(op2);
      }
    }
    return null;
  }
  public simplify(): Operation {
    const op = this.op.simplify();
    if (op instanceof NoOp) {
      return new NoOp();
    }
    return this;
  }
}

class Put implements Operation {
  constructor(
    public readonly key: string,
    public readonly value: Value
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: { [k:string]: Value } = __value as { [k:string]: Value };
    const d: typeof _value = shallow_clone(_value);
    d[this.key] = this.value;
    return obj(d);
  }
  // eslint-disable-next-line
  public rebase(other: Operation): [Operation,Operation] | null {
    return null;
  }
  public invert(): Operation {
    return new Remove(this.key, this.value);
  }

  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) {
      return this;
    }
    if (other instanceof Set) {
      return new Set(
        this.invert().apply(
          other.old_value),
        other.new_value).simplify();
    }
    if (other instanceof Remove) {
      if (this.key === other.key) {
        return new NoOp();
      }
    }
    if (other instanceof Rename) {
      if (this.key === other.old_key) {
        return new Put(other.new_key, this.value);
      }
    }
    if (other instanceof ObjectApply) {
      if (this.key === other.key) {
        return new Put(
          this.key,
          other.op.apply(this.value)
        );
      }
    }
    return null;
  }
  public simplify(): Operation {
    return this;
  }
}

class Remove implements Operation {
  constructor(
    public readonly key: string,
    public readonly old_value: Value
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: { [k:string]: Value } = __value as { [k:string]: Value };
    const d: typeof _value = shallow_clone(_value);
    delete d[this.key];
    return obj(d);
  }

  public simplify(): Operation {
    return this;
  }

  public invert(): Operation {
    return new Put(this.key, this.old_value);
  }

  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) { return this; }
    if (other instanceof Set) {
      return new Set(
        this.invert().apply(
          other.old_value
        ),
        other.new_value
      ).simplify();
    }
    if (other instanceof Put) {
      if (this.key === other.key) {
        return new ObjectApply(this.key, new Set(other.value));
      }
    }
    return null;
  }

  public rebase(other: Operation): [Operation, Operation] | null {
    if (other instanceof NoOp) { return [this, other]; }
    if (other instanceof Remove) {
      if (this.key === other.key) {
        return [ new NoOp(), new NoOp() ];
      }
      return [this, other];
    }
    if (other instanceof Rename) {
      if (this.key === other.old_key) {
        return [
          new Remove(other.new_key, this.old_value),
          new NoOp()
        ];
      }
      return [this, other];
    }
    if (other instanceof ObjectApply) {
      if (this.key === other.key) {
        return [
          new Remove(this.key, other.op.apply(this.old_value)),
          new NoOp()
        ];
      }
      return [this, other];
    }
    return null;
  }
}

class Rename implements Operation {
  constructor(
    public readonly old_key: string,
    public readonly new_key: string
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: { [k:string]: Value } = __value as { [k:string]: Value };
    const d: typeof _value = shallow_clone(_value);
    const v = d[this.old_key];
    delete d[this.old_key];
    d[this.new_key] = v;
    return obj(d);
  }

  public simplify(): Operation {
    return this;
  }

  public invert(): Operation {
    return new Rename(this.new_key, this.old_key);
  }

  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) {
      return this;
    }
    if (other instanceof Set) {
      return new Set(
        this.invert().apply(
          other.old_value
        ),
        other.new_value
      ).simplify();
    }
    if (other instanceof Remove) {
      if (this.new_key === other.key) {
        return new Remove(this.old_key,atom(this.new_key));
      }
    }
    return null;
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) { return [this, other]; }
    if (other instanceof Rename) {
      if(this.old_key === other.old_key) {
        if (this.new_key === other.new_key) {
          return [ new NoOp(), new NoOp() ];
        }

        if (cmp(this.new_key, other.new_key) < 0) {
          return [
            new NoOp(),
            new Rename(this.new_key, other.new_key)
          ];
        }
        return null;
      }
      if (this.new_key === other.new_key) {
        if (cmp(this.old_key, other.old_key) < 0) {
          return [
            new NoOp(),
            other
          ];
        }
        return null;
      }
      return [this, other];
    }
    if (other instanceof ObjectApply) {
      if (this.old_key === other.key) {
        return [
          this,
          new ObjectApply(this.new_key, other.op)
        ];
      }
      return [this, other];
    }
    return null;
  }
}

class ObjectApply implements Operation {
  constructor(
    public readonly key: string,
    public readonly op: Operation
  ) {}

  public apply(value: Value): Value {
    const __value: unknown = out(value);
    const _value: { [k:string]: Value } = __value as { [k:string]: Value };
    const d: Partial<typeof _value> = {};
    for (const k in _value) {
      d[k] = _value[k];
    }
    d[this.key] = this.op.apply(d[this.key] as Value);
    return obj(d as typeof _value) as Value;
  }

  public simplify(): Operation {
    const op2 = this.op.simplify();
    if (op2 instanceof NoOp) {
      return new NoOp();
    }
    return this;
  }

  public invert(): Operation {
    return new ObjectApply(this.key, this.op.invert());
  }

  public compose(other: Operation): Operation | null {
    if (other instanceof NoOp) { return this; }
    if (other instanceof Set) {
      return new Set(
        this.invert().apply(other.old_value),
        other.new_value
      ).simplify();
    }
    if (other instanceof Remove) {
      if (this.key === other.key) {
        return other.simplify();
      }
    }
    if (other instanceof ObjectApply) {
      if (this.key === other.key) {
        const op2 = this.op.compose(other.op);
        if (op2) {
          return new ObjectApply(this.key, op2);
        }
      }
    }
    return null;
  }

  public rebase(other: Operation): [Operation,Operation] | null {
    if (other instanceof NoOp) { return [this, other]; }
    if (other instanceof ObjectApply) {
      if (this.key !== other.key) {
        return [this, other];
      }
      const opa = this.op.rebase(other.op);
      const opb = other.op.rebase(this.op);
      if (opa && opb) {
        return [
          (opa instanceof NoOp)
            ? new NoOp()
            : new ObjectApply(this.key, opa[0]),
          (opb instanceof NoOp)
            ? new NoOp()
            : new ObjectApply(other.key, opb[1])
        ];
      }
    }
    return null;
  }
}

export {
  Operation,
  serialize,
  deserialize,
  NoOp,
  Splice,
  Insert,
  Delete,
  Move,
  ArrayApply,
  Set,
  Map,
  List,
  Put,
  Remove,
  Rename,
  ObjectApply
};
