import {
  Value,
  arr,
  atom
} from "./value";

import { cmp, out } from "./util";
import deepEqual from "deep-equal";

interface Operation {
  apply(value: Value): Value;
  rebase(other: Operation): [Operation,Operation] | null;
  invert(): Operation;
  compose(other: Operation): Operation | null;
  simplify(): Operation;
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

class Splice implements Operation {
  protected old_value: string | Value[];
  protected new_value: string | Value[];
  constructor(
    protected pos: number,
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
    if ("string" === typeof _value) {
      return atom(item1 + (this.new_value as string) + item3);
    }
    else if (Array.isArray(_value)) {
      return arr(
        (item1 as Value[])
          .concat(this.new_value as Value[])
          .concat(item3 as Value[])
      );
    }
    else
    { throw new Error(`cannot splice value ${value}`); }
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
        const item1 : string | unknown[] = this.new_value.slice(0, other.pos - this.pos);
        const item2 : typeof item1 = other.new_value;
        const item3 : typeof item2 = this.new_value.slice(
          this.new_value.length +
            (other.pos + other.old_value.length) -
            (this.pos + this.new_value.length)
        );
        if ("string" === typeof item1) {
          return new Splice(
            this.pos,
            this.old_value,
            item1 + item2 + item3
          );
        }
        else if (Array.isArray(item1)) {
          return new Splice(
            this.pos,
            this.old_value,
            item1.concat(item2).concat(item3)
          );
        }
        else {
          throw new Error("AAHHH");
        }
      }

      if (other.pos <= this.pos
        && this.pos + this.new_value.length <=
        other.pos + other.old_value.length) {
        let item1 : string | unknown[] = other.old_value.slice(0, this.pos - other.pos);
        let item2 : typeof item1  = other.old_value;
        let item3 : typeof item2  = other.old_value.slice(
          other.old_value.length + (this.pos + this.new_value.length) - (other.pos + other.old_value.length));
        if ("string" === typeof item1) {
          return new Splice(
            other.pos,
            item1 + item2 + item3,
            other.new_value
          );
        }
        else if (Array.isArray(item1)) {
          return new Splice(
            other.pos,
            item1.concat(item2).concat(item3),
            other.new_value
          );
        }
        else {
          throw new Error("AHHHHHHHHH");
        }
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
    if (other instanceof Splice) {
      return this.rebase_splice(other);
    }
    if (other instanceof NoOp) { return [this,other]; }
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
      // we absorb their splice into ours
      if ("string" === typeof item1 && "string" === typeof item3) {

        return [
          new Splice(
            this.pos,
            item1 + (other.new_value as string) + item3,
            this.new_value
          ),
          new NoOp()
        ];
      }
      else if (Array.isArray(item1) && Array.isArray(item3)) {
        return [
          new Splice(
            this.pos,
            item1.concat(other.new_value as Value[]).concat(item3),
            this.new_value
          ),
          new NoOp()
        ];
      }
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

export {
  Operation,
  NoOp,
  Splice,
  Insert,
  Delete
};
