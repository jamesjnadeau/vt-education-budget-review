/// <reference types="astro/client" />

// The model page hands data to its client script through two globals set on
// `window` in an `is:inline` script (JSON.parse'd there) and read in the
// processed module script. Declaring them here is what lets astro check
// typecheck that read site. Types mirror initModelTool's signature.
import type { RawParameterSet, ResolvedAdmData } from './scripts/model-tool';

declare global {
  interface Window {
    __VT_PARAMETERS__?: RawParameterSet[];
    __VT_RESOLVED_ADM__?: ResolvedAdmData;
  }
}

export {};
