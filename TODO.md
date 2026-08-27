# Mupen64Plus-Next port: pending work

## Not yet tested at all
- [ ] Actually run the built core in a browser against a real ROM. Everything below this point is unverified until this happens - the build succeeding only proves the toolchain and symbol table are sound, not that it runs.
- [ ] Confirm the fiber-based coroutine switch (emscripten_fiber.c / libco) actually works at runtime and doesn't hang or crash partway through a frame. This was the whole reason emsdk had to move to 1.39.10.
- [ ] Confirm RetroAchievements hooks work for this core (should be automatic via the base class, but unconfirmed).

## Controls are wrong, need a real rework
- [ ] Arrow keys currently map to the D-pad (`CIDS.UP/DOWN/LEFT/RIGHT`). They need to drive the **control stick** instead - that's the primary movement input in nearly every N64 game. See `webrcade-app-parallel-n64/src/emulator/index.js:89-117` for the old app's scheme (`ANALOG_UP/DOWN/LEFT/RIGHT`).
- [ ] No keyboard path to C-buttons at all right now. Old app used `W/A/S/D`. C-buttons come from the right analog stick in the generic `_wrc_set_input` ABI, which has no keyboard fallback - this needs digital-key-to-analog-axis synthesis, not just a `KeyCodeToControlMapping` table.
- [ ] No keyboard path to the D-pad once arrows are correctly reassigned to the stick. Old app used `I/J/K/L`.
- [ ] This all means a `KeyCodeToControlMapping` subclass alone isn't enough - need a custom `sendInput()`/`pollControls()` override (shape similar to `webrcade-app-retro-mame-astrocade`'s `sendInput()`) that synthesizes stick/C-button values from key state, the way the old app's custom `pollControls()` did with its `ANALOG_*`/`C_*` bit-tagged pseudo-controls.
- [ ] Reconsider `Z`/`X` button letter assignment - old app used `Z->B, X->A`; current mapping inherited the shared default's `Z->A, X->B` (opposite). Decide which is actually expected/tested.
- [ ] Old app has `Ctrl`/`Shift` as stick-magnitude reduction modifiers (50%/25%) for precision movement. No equivalent currently.
- [ ] Old app uses `C/V` for L/R shoulder buttons; current mapping uses the shared default's `Q/W`. Confirm which is intended.
- [ ] Once keyboard is sorted, actually test with a real gamepad - the C-side WRC mapping (A/B/Z/L/R/C-buttons/stick) was reasoned from precedent (`dosbox-pure`'s `wrc_input_state_analog` usage) but never played.

## Confirmed dead code to remove
- [ ] Remove `createAudioProcessor()`, `audioCallback`, and the `ScriptAudioProcessor` import from `src/emulator/index.js`. Confirmed via `RetroAppWrapper` in `webrcade-app-common/src/app/retrowrapper/index.js`: `createAudioProcessor()` is a no-op stub (`return null`) never called anywhere in the base class, and `this.audioCallback` is never read. Real audio goes through `Module._rwebaudio_enable()` + `Module._cmd_audio_reinit()`, RetroArch's own built-in WebAudio bridge - no per-app JS needed. This was copy-pasted forward from mgba/genplusgx, where it's equally dead.

## PAL support - missing entirely
- [ ] `createDisplayLoop()` hardcodes 60fps. No PAL/region detection at all.
- [ ] Check whether the mupen64plus-next core (`retrostash/mupen64plus-libretro-nx`) exposes any PAL/region query to JS, equivalent to N64Wasm's `_isPalSystem()` export that the old app used to pick 50 vs 60fps.
- [ ] If no such hook exists in the current WRC ABI, figure out whether it needs adding on the C side (an exported `_wrc_`-style function) or whether region can be inferred another way (ROM header parsing on the JS side, core option, etc).

## Save data - only partially handled
- [ ] Current `saveState()`/`loadState()` only handle a single `game.srm` file (EEPROM/SRAM/FlashRAM via the standard libretro save-RAM path), matching the mgba/genplusgx pattern.
- [ ] Controller Pak (mempak) contents are a separate, non-standard save surface on real N64 hardware - not yet verified whether the core exposes this through the same save-RAM mechanism or needs its own handling. Some games rely on mempak data specifically.

## Build/toolchain follow-ups
- [ ] `emsdk-1.39.10` Docker container is separate/isolated from the main `emsdk-1.39.5` one. If this becomes the permanent build setup for this core, document it properly (not just tribal knowledge in this conversation).
- [ ] Revisit `GLES3`/WebGL2. Currently forced to ES2 (`EMULATORJS_LEGACY=1`) to dodge the `glsym`/`__rglgen_*` symbol collision against RetroArch's shared frontend build. EmulatorJS's own config for this core sets `defaultWebGL2: true` - worth figuring out the ES3-compatible fix once things are stable, since it affects rendering quality.
- [ ] `mupen64plus-cpucore` is set to `pure_interpreter` in the `.opt` file for safety. Once stability is confirmed, test `cached_interpreter` for better performance.
- [ ] `-s EMULATE_FUNCTION_POINTER_CASTS=1` was added as a blanket safety net for function-pointer signature mismatches (the exact bug class that likely explains upstream's reported WASM crashes). Worth narrowing down to just the specific call sites that need it once things are stable, since it has a runtime cost.
- [ ] The `#include "../../../../wrc.h"` relative path depth in `emulate_game_controller_via_libretro.c` was computed by counting directories, not copied from a working precedent (other cores in this codebase are inconsistent about the depth). The build succeeded, so it's presumably correct, but flag as inferred rather than verified-against-precedent.

## Deferred by explicit request (second pass)
- [ ] The actual GLideN64 texture-cache/memory investigation - this was the original point of the exercise (porting the memory/crash fixes from N64Wasm's Glide64 work), explicitly deferred to focus on "get it working first." Revisit once there's a running, testable build. See memory `project_n64_mupen64plus_next_feasibility` for why the original Glide64 patches don't port directly (GLideN64 is an unrelated codebase) and what transfers as a checklist of symptoms instead.

## App registration follow-ups
- [ ] `webrcade-app-common`'s `dist/` needs rebuilding before the new `APP_TYPE_KEYS.RETRO_MUPEN64PLUS_NEXT` entry is visible anywhere (package resolution points at `dist/index.js`, not `src/`).
- [ ] `npm install` never run for the new app directory (needs `@webrcade/app-common` linked via `file:../webrcade-app-common`).
- [ ] New app reuses the existing `n64-background.png`/`n64-thumb.png` art - no distinct thumbnail/background yet to help users tell the two N64 options apart in the editor.
