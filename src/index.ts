export * from "./value";
export * from "./operations";
export * from "./editor";

import type { Editor } from "./";
import {
  Splice,
  Insert,
  Delete,
  create_editor
} from "./";

const doc_original = "Gatlin";

const editor: Editor = create_editor(
  "doc-1",
  doc_original,
  () => { return; }
);

editor.send({
  type: "edit",
  operation: new Insert(1, "o"),
  base_revision: 0,
  sender_id: "sender-1"
});

editor.send({
  type: "edit",
  operation: new Delete(3, "lin"),
  base_revision: 0,
  sender_id: "sender-2"
});

editor.send({
  type: "edit",
  operation: new Splice(0, "G", "g"),
  base_revision: 1,
  sender_id: "sender-1"
});

console.log(
  "result",
  JSON.stringify(
    editor.context,
    null,
    2
  )
);

