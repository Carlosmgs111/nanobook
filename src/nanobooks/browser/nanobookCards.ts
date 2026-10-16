export function initNanobookCards() {
  document.querySelectorAll<HTMLElement>("[data-nanobook-card]").forEach(card => {
    if (card.dataset.bound) return;
    card.dataset.bound = "true";
    let busy = false;
    card.querySelectorAll<HTMLFormElement>("form[data-operation]").forEach(form => {
      const error = form.querySelector<HTMLElement>("[data-error]")!;
      form.querySelector<HTMLButtonElement>("[data-cancel]")!.addEventListener("click", () => {
        form.reset();
        error.textContent = "";
        form.closest("details")!.open = false;
      });
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        error.textContent = "";
        const data = new FormData(form);
        const deleting = form.dataset.operation === "delete";
        const assigningTheme = form.dataset.operation === "theme";
        const controls = card.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input, button, select");
        controls.forEach(control => control.disabled = true);
        form.setAttribute("aria-busy", "true");
        try {
          const response = await fetch(`/api/nanobooks/${encodeURIComponent(card.dataset.id!)}${assigningTheme ? "/theme" : ""}`, {
            method: assigningTheme ? "POST" : deleting ? "DELETE" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assigningTheme ? { reference: JSON.parse(String(data.get("themeReference"))) } : deleting ? { confirmationName: data.get("confirmationName") } : {
              name: data.get("name"), slug: data.get("slug"), visibility: data.get("visibility"),
            }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "No fue posible guardar los cambios");
          }
          window.location.reload();
        } catch (cause) {
          error.textContent = cause instanceof Error ? cause.message : "No fue posible guardar los cambios";
        } finally {
          busy = false;
          controls.forEach(control => control.disabled = false);
          form.removeAttribute("aria-busy");
        }
      });
    });
  });
}
