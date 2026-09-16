import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { indentWithTab } from "@codemirror/commands";

export interface CodeMirrorEditorOptions {
  container: HTMLElement;
  initialContent: string;
  onChange?: (content: string) => void;
}

export interface CodeMirrorEditorInstance {
  getContent: () => string;
  destroy: () => void;
}

export function createCodeMirrorEditor(
  options: CodeMirrorEditorOptions
): CodeMirrorEditorInstance {
  const { container, initialContent, onChange } = options;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialContent,
    extensions: [
      basicSetup,
      markdown(),
      keymap.of([indentWithTab]),
      updateListener,
      EditorView.theme({
        "&": {
          fontSize: "14px",
          minHeight: "60vh",
        },
        ".cm-content": {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          lineHeight: "1.6",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--grid-line)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "var(--grid-line)",
        },
      }),
      EditorView.lineWrapping,
    ],
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return {
    getContent: () => view.state.doc.toString(),
    destroy: () => view.destroy(),
  };
}
