/**
 * Marcador que rodea a un bloque de componente de raíz en el HTML renderizado:
 *
 *   <!--nb:block-start NOMBRE PROPS_BASE64URL-->…<!--nb:block-end-->
 *
 * Las props van en base64url porque su alfabeto (`A-Z a-z 0-9 - _`) no contiene
 * `>`, así que el comentario siempre termina donde debe y se localiza con
 * búsquedas de texto, sin analizar atributos HTML.
 */
export const BLOCK_START = "<!--nb:block-start ";
export const BLOCK_END_COMMENT = "nb:block-end";
export const BLOCK_END = `<!--${BLOCK_END_COMMENT}-->`;
export const BLOCK_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Valor del nodo comentario hast; rehype-stringify lo imprime entre `<!--` y `-->`. */
export function blockStartComment(name: string, props: unknown): string {
  return `nb:block-start ${name} ${toBase64Url(JSON.stringify(props))}`;
}

/**
 * Lee la cabecera (texto entre `BLOCK_START` y `-->`). Devuelve `undefined` si
 * no se puede leer; nunca lanza.
 */
export function decodeBlockHeader(header: string): { name: string; props: unknown } | undefined {
  const separator = header.indexOf(" ");
  if (separator === -1) return undefined;

  const name = header.slice(0, separator);
  if (!BLOCK_NAME_PATTERN.test(name)) return undefined;

  try {
    return { name, props: JSON.parse(fromBase64Url(header.slice(separator + 1))) };
  } catch {
    return undefined;
  }
}
