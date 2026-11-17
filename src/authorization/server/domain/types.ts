/** Quién pide el acceso. La sesión se resuelve de forma perezosa: solo si una política la necesita. */
export type Subject = {
  userId(): Promise<string | undefined>;
  /** Credencial presentada para un recurso concreto (p. ej. token de desbloqueo de un documento). */
  grantFor(resourceId: string): string | undefined;
};

export const Subject = {
  /** Sujeto sin sesión ni credenciales. */
  anonymous(): Subject {
    return {
      userId: async () => undefined,
      grantFor: () => undefined,
    };
  },
  /** Sujeto con el usuario ya conocido o con una resolución perezosa que se ejecuta una sola vez. */
  of(
    userId: string | undefined | (() => Promise<string | undefined>),
    grantFor: (resourceId: string) => string | undefined = () => undefined,
  ): Subject {
    let pending: Promise<string | undefined> | undefined;
    return {
      userId: () =>
        (pending ??= typeof userId === "function" ? userId() : Promise.resolve(userId)),
      grantFor,
    };
  },
};

export type Action = "read" | "write";

export type Resource = {
  /** Tipo definido por el módulo dueño del recurso: "nanobook", "document"... */
  type: string;
  id: string;
  nanobookId?: string;
  /** Hechos ya cargados por código de servidor del módulo dueño. Nunca provienen del cliente. */
  attributes?: Readonly<Record<string, unknown>>;
};

export type AccessRequest = {
  subject: Subject;
  action: Action;
  resource: Resource;
};

export type DenyReason = "unauthenticated" | "forbidden" | "not-found";

export type Decision =
  | { effect: "allow" }
  | { effect: "abstain" }
  | { effect: "deny"; reason: DenyReason }
  | { effect: "challenge"; kind: "password" };

/** Lo que devuelve el motor: `abstain` nunca sale de él. */
export type ResolvedDecision = Exclude<Decision, { effect: "abstain" }>;

/** Una decisión que no concede acceso. */
export type DeniedDecision = Extract<Decision, { effect: "deny" | "challenge" }>;

export type Authorize = (request: AccessRequest) => Promise<ResolvedDecision>;

export interface Policy {
  /** Tipos de recurso que evalúa esta política. */
  readonly appliesTo: readonly string[];
  /**
   * `authorize` permite consultar otra acción sobre el mismo recurso.
   * Una política nunca debe consultar una acción que la lleve de vuelta a sí misma.
   */
  evaluate(request: AccessRequest, authorize: Authorize): Promise<Decision>;
}
