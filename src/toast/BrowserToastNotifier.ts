export type ToastKind = "loading" | "success" | "error" | "info";

export interface ToastOptions {
  id?: string;
  duration?: number;
}

export interface ToastNotifier {
  show(message: string, kind: ToastKind, options?: ToastOptions): string;
}

interface ShowToastEvent {
  operation: "show";
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
}

interface DismissToastEvent {
  operation: "dismiss";
  id: string;
}

type ToastEventDetail = ShowToastEvent | DismissToastEvent;

const eventName = "nanobook:toast";

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}-${Math.random()}`;
}

export class BrowserToastNotifier implements ToastNotifier {
  constructor(private readonly defaultId?: string) {}

  show(message: string, kind: ToastKind, options: ToastOptions = {}): string {
    const id = options.id ?? this.defaultId ?? createId();
    const defaultDuration = kind === "error" || kind === "loading" ? 0 : 4500;

    this.publish({
      operation: "show",
      id,
      kind,
      message,
      duration: options.duration ?? defaultDuration,
    });

    return id;
  }

  loading(message: string, options?: ToastOptions): string {
    return this.show(message, "loading", options);
  }

  success(message: string, options?: ToastOptions): string {
    return this.show(message, "success", options);
  }

  error(message: string, options?: ToastOptions): string {
    return this.show(message, "error", options);
  }

  info(message: string, options?: ToastOptions): string {
    return this.show(message, "info", options);
  }

  dismiss(id = this.defaultId): void {
    if (!id) return;
    this.publish({ operation: "dismiss", id });
  }

  private publish(detail: ToastEventDetail): void {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export const toast = new BrowserToastNotifier();
