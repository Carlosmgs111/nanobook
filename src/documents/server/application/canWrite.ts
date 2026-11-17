import type { WriteAccess } from "../domain/ports/WriteAccess";

/** Sin usuario no consulta el puerto, y un fallo cuenta como «no escritor»: la lectura falla cerrada. */
export async function canWrite(
  writeAccess: WriteAccess,
  nanobookId: string,
  userId: string | undefined
): Promise<boolean> {
  return (
    Boolean(userId) &&
    (await writeAccess.require(nanobookId, userId as string)).isSuccess
  );
}
