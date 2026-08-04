/// <reference types="astro/client" />

// The model page hands data to its client script through two globals set on
// `window` in an `is:inline` script (JSON.parse'd there) and read in the
// processed module script. Declaring them here is what lets astro check
// typecheck that read site. Types mirror initModelTool's signature.
//
// This file is picked up by both `astro check` (tsconfig.astro.json's
// `src/**/*`) and the site composite `tsc --build` (tsconfig.json's
// `include: ["src/**/*.ts"]` also matches `.d.ts`). The two Window members
// below are intentionally optional, so this augmentation is purely additive
// and can't affect assignability elsewhere in the composite `.ts` program.
import type { RawParameterSet, ResolvedAdmData } from './scripts/model-tool';

declare global {
  interface Window {
    __VT_PARAMETERS__?: RawParameterSet[];
    __VT_RESOLVED_ADM__?: ResolvedAdmData;
  }
}

export {};
