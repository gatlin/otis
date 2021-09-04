/**
 * @experimental
 */

import {
  createMachine,
  reduce,
  state,
  transition,
  immediate,
  interpret
} from "robot3";
import type { Service } from "robot3";

import type { Operation } from "./operations";
import { NoOp } from "./operations";

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

const editorMachine = createMachine(
  {
    IDLE: state(
      transition(
        "edit",
        "EDITING",
        reduce((ctx: EditorContext, evt: Edit & { type: "edit" }) => {
          const { operation, base_revision } = evt;
          const { _revision, _history, _body } = ctx;
          if (base_revision > _revision) {
            throw new Error(
              `error: base revision ${base_revision} > ${_revision}`
            );
          }
          let rebase_root = new NoOp();
          for (const op of _history
            .slice(0, _revision - base_revision)
            .reverse()) {
            rebase_root = rebase_root.compose(op) || new NoOp();
          }
          const rebased = rebase_root.rebase(operation);
          if (!rebased) {
            throw new Error("error rebasing");
          }
          return {
            ...ctx,
            _body: rebased[1].apply(_body),
            _revision: _revision + 1,
            _history: [rebased[1], ..._history]
          };
        })
      )
    ),
    EDITING: state(immediate("IDLE"))
  },
  (initialContext: EditorContext): EditorContext => ({
    ...initialContext
  })
);

type Editor = Service<typeof editorMachine>;

const create_editor = (
  _id: string,
  _raw_body: unknown,
  step: () => void
): Editor => {
  const service: Editor = interpret(
    editorMachine,
    () => {
      return step();
    },
    {
      _id,
      _body: represent(_raw_body),
      _revision: 0,
      _history: []
    }
  );
  return service;
};

export type { Edit, Editor, EditorContext };

export { editorMachine, create_editor };
