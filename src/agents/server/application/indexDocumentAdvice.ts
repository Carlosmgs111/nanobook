import { DocumentPath } from "../../../documents/server/domain/DocumentPath";

/**
 * Una página de índice (`index` o cualquier ruta que termine en `/index`)
 * muestra su título, su descripción y la lista de los documentos que cuelgan
 * de ella; su cuerpo no se renderiza. Un agente que escribe ahí la información
 * crea contenido que nadie verá, y la API de escritura lo acepta sin quejarse.
 *
 * Devuelve un aviso si el contenido enviado a un índice tiene algo más que
 * líneas en blanco y el título de primer nivel (que es lo que crea el sistema),
 * y `undefined` en cualquier otro caso.
 */
export function indexBodyWarning(path: string, content: string): string | undefined {
  const parsed = DocumentPath.create(path);
  if (!parsed.isSuccess || !parsed.getValue().isIndex()) return undefined;

  const hasBody = content.split("\n").some((line) => {
    const text = line.trim();
    return text !== "" && !/^#\s/.test(text);
  });
  if (!hasBody) return undefined;

  return `Aviso: «${path}» es un documento índice. Su página solo muestra el título, la descripción y la lista de los documentos que cuelgan de él; el cuerpo que enviaste no se muestra. Mueve esa información a un documento propio con create_document (por ejemplo con path «resumen») y deja el índice solo con título y descripción.`;
}
