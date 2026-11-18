import { describe, expect, it } from "vitest";
import { InitializeEditor } from "./InitializeEditor";
import { HandleEditorChange } from "./HandleEditorChange";
import { SessionStorageDocumentStorage } from "../infraestructure/storage/SessionStorageDocumentStorage";
import { YamlDocumentContentParser } from "../infraestructure/parser/YamlDocumentContentParser";
import { buildSerializedEntry, FakeStorage } from "./test/factories";

function setup() {
  const storage = new SessionStorageDocumentStorage(new FakeStorage());
  return {
    storage,
    initialize: new InitializeEditor(storage),
    change: new HandleEditorChange(new YamlDocumentContentParser(), storage),
  };
}

describe("flujo del editor", () => {
  it("la primera apertura deja la base como borrador y los cambios lo reemplazan", async () => {
    const { storage, initialize, change } = setup();
    const base = buildSerializedEntry();

    expect(initialize.execute(base).getValue()).toEqual(base);

    const edited = (await change.execute(base, '---\ntitle: "Nuevo"\n---\n# Cuerpo')).getValue();
    expect(edited).toMatchObject({ title: "Nuevo", content: "# Cuerpo" });
    expect(storage.loadStagedDocument(base.documentId).getValue()).toEqual(edited);
    expect(initialize.execute(base).getValue()).toEqual(edited);
  });

  it("un cambio invalida la confirmación y no guarda YAML inválido", async () => {
    const { storage, change } = setup();
    const base = buildSerializedEntry();
    storage.saveConfirmedDocument(base.documentId, base);

    const invalid = await change.execute(base, "---\ntitle: [abierto\n---\n");
    expect(invalid.isSuccess).toBe(false);
    expect(storage.loadStagedDocument(base.documentId).getValue()).toBeNull();
    expect(storage.loadConfirmedDocument(base.documentId).getValue()).not.toBeNull();

    await change.execute(base, '---\ntitle: "Ok"\n---\n');
    expect(storage.loadConfirmedDocument(base.documentId).getValue()).toBeNull();
  });

  it("si el borrador ya estaba guardado y el servidor avanzó, vuelve a la base nueva", () => {
    const { storage, initialize } = setup();
    const old = buildSerializedEntry();
    storage.saveStagedDocument(old.documentId, old);
    storage.saveConfirmedDocument(old.documentId, old);
    const serverVersion = { ...old, title: "Del servidor", version: "v2" };

    expect(initialize.execute(serverVersion).getValue()).toEqual(serverVersion);
  });

  it("en documentos proxy solo se edita el frontmatter y se conserva el cuerpo origen", async () => {
    const { change } = setup();
    const base = buildSerializedEntry({ content: "cuerpo origen", metadata: { ref: "/README.md" } as never });

    const result = await change.execute(base, '---\ntitle: "Proxy"\n---\n', true);

    expect(result.getValue()).toMatchObject({ title: "Proxy", content: "cuerpo origen" });
  });
});
