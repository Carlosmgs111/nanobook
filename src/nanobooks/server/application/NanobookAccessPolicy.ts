import type { AccessRequest, Decision, Policy } from "../../../authorization/server";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";

/**
 * Dueño y visibilidad. El dueño y la visibilidad se leen siempre del repositorio:
 * nunca de `attributes`, que no es una fuente confiable para estos hechos.
 */
export class NanobookAccessPolicy implements Policy {
  readonly appliesTo = ["nanobook", "document"] as const;

  constructor(private readonly repository: NanobookRepository) {}

  async evaluate({ subject, action, resource }: AccessRequest): Promise<Decision> {
    const nanobookId = resource.type === "nanobook" ? resource.id : resource.nanobookId;
    if (!nanobookId) return { effect: "deny", reason: "forbidden" };

    // En escritura la sesión se resuelve una sola vez; en lectura pública no se resuelve.
    const userId = action === "write" ? await subject.userId() : undefined;

    // Un anónimo no puede escribir: se decide antes de consultar si el nanobook existe,
    // para que no pueda distinguir un nanobook privado de uno inexistente.
    if (action === "write" && !userId) {
      return { effect: "deny", reason: "unauthenticated" };
    }

    const found = await this.repository.findById(nanobookId);
    if (!found.isSuccess) throw found.getError();
    const nanobook = found.getValue();
    if (!nanobook) return { effect: "deny", reason: "not-found" };

    if (action === "read" && nanobook.getVisibility() === "public") return { effect: "allow" };

    const requester = action === "write" ? userId : await subject.userId();
    if (requester !== undefined && requester === nanobook.getOwnerId()) return { effect: "allow" };

    // Quien no puede ver un nanobook privado no debe poder detectar que existe.
    return nanobook.getVisibility() === "private"
      ? { effect: "deny", reason: "not-found" }
      : { effect: "deny", reason: "forbidden" };
  }
}
