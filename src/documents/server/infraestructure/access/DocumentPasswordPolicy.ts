import type { AccessRequest, Authorize, Decision, Policy } from "../../../../authorization/server";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";

/**
 * Protección por contraseña: solo restringe lecturas. Nunca devuelve `allow`; la lectura la concede
 * la política del módulo dueño del nanobook y esta puede exigir un desafío.
 */
export class DocumentPasswordPolicy implements Policy {
  readonly appliesTo = ["document"] as const;

  constructor(
    private readonly accessRepository: DocumentAccessRepository,
    private readonly codec: AccessGrantCodec,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async evaluate(request: AccessRequest, authorize: Authorize): Promise<Decision> {
    if (request.action !== "read") return { effect: "abstain" };

    const securedIds = request.resource.attributes?.securedIds;
    if (!Array.isArray(securedIds) || !securedIds.every((id): id is string => typeof id === "string")) {
      return { effect: "deny", reason: "forbidden" };
    }
    if (securedIds.length === 0) return { effect: "abstain" };

    // El escritor del nanobook no necesita contraseña.
    if ((await authorize({ ...request, action: "write" })).effect === "allow") return { effect: "abstain" };

    // Cada eslabón protegido de la cadena exige su propio grant válido.
    for (const documentId of securedIds) {
      if (!(await this.hasValidGrant(documentId, request.subject.grantFor(documentId)))) {
        return { effect: "challenge", kind: "password" };
      }
    }
    return { effect: "abstain" };
  }

  private async hasValidGrant(documentId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;

    const record = await this.accessRepository.get(documentId);
    // Un fallo de lectura o un hash ausente nunca concede acceso.
    if (!record.isSuccess) return false;
    const value = record.getValue();
    if (!value || value.passwordHash === null) return false;

    return this.codec.verify(token, {
      documentId,
      passwordVersion: value.passwordVersion,
      now: this.clock(),
    });
  }
}
