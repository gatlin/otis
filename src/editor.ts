import {
  createMachine,
  reduce,
  state,
  transition,
  immediate,
  interpret,
  Service
} from "robot3";

import type { Operation } from "./operations";
import { List, NoOp, serialize } from "./operations";

import type { Value } from "./value";
import { represent } from "./value";

interface EditorContext {
  _id: string;
  _body: Value;
  _revision: number;
  _history: Operation[];
}

interface Edit {
  operation: Operation;
  base_revision: number;
  sender_id: string;
}

const editorMachine = createMachine({
  IDLE: state(
    transition(
      "edit",
      "EDITING",
      reduce((ctx: EditorContext, evt: Edit & { type: "edit" }) => {
        const { operation, base_revision, sender_id } = evt;
        const { _revision, _history, _body } = ctx;
        console.log("EDITING revision", _revision);
        if (base_revision > _revision) {
          throw new Error(`error: base revision ${base_revision} > ${_revision}`);
        }
        let rebase_root = new NoOp();
        for (let op of _history.slice(0, (_revision - base_revision)).reverse()) {
          rebase_root = rebase_root.compose(op) || new NoOp();
        }
        let rebased = rebase_root.rebase(operation);
        if (!rebased) {
          throw new Error(`error rebasing`);
        }
        const [rebase_root_prime, operation_prime] = rebased;
        return {
          ...ctx,
          _body: operation_prime.apply(_body),
          _revision: _revision + 1,
          _history: [ operation_prime , ..._history]
        };
      })
    )
  ),
  EDITING: state(
    immediate('IDLE')
  )
}, (initialContext: EditorContext): EditorContext => ({
  ...initialContext
}));

type Editor = Service<typeof editorMachine>;

const create_editor = (
  _id: string,
  _raw_body: unknown,
  step: () => void
): Editor => {
  const service: Editor = interpret(editorMachine, () => {
    return step();
  }, {
    _id,
    _body: represent(_raw_body),
    _revision: 0,
    _history: []
  });
  return service;
};

export type {
  Editor,
  EditorContext
};

export {
  create_editor
};
