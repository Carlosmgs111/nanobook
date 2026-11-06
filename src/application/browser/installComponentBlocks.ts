import { financialComponentMounts } from "../../financial-content/browser/financialComponentMounts";
import { registerComponentBlocks } from "../../rendering/browser/componentRegistry";
import { installComponentBlocks } from "../../rendering/browser/mountComponentBlocks";

/** Registra los componentes de cada módulo y activa el montaje en la página. */
registerComponentBlocks(financialComponentMounts);
installComponentBlocks();
