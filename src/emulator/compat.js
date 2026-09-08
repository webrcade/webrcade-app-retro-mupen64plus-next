// Per-ROM (MD5) known-issue warnings and emulator setting overrides for
// THIS core specifically (mupen64plus-next / GLideN64) - unlike
// webrcade-app-retro-parallel-n64's compat.js (ported from the older
// N64Wasm-era core and not yet re-verified here), these entries are
// observed directly on this core.
const MESSAGES = {
  periodicFreeze: 'Periodically freezes.',
  graphicalIssues: 'Various graphical glitches, but playable.',
  blankTitle: 'Title screen renders blank.',
};

const M = MESSAGES;

// Single lookup table for per-title tweaks - add an entry here (keyed by
// ROM MD5) instead of a new one-off MD5 list/prop check in index.js.
// Supported keys (all optional):
//   useGles2        - force the GLES2/WebGL1 build instead of the default
//                      GLES3/WebGL2 one (see getScriptUrl())
//   nativeResFactor - mupen64plus-EnableNativeResFactor override (string,
//                      e.g. "1" for no internal upscaling)
//   fbEmulation     - mupen64plus-EnableFBEmulation override (true/false;
//                      omit to leave at the core's own default)
//   countPerOp      - mupen64plus-CountPerOp override (number)
//   audioLatency    - not currently wired up (getRaConfigContents() sets
//                      no explicit audio_latency for now, testing whether
//                      it's actually necessary from a clean slate first);
//                      reserved here as 0=Low/128, 1=Medium/256, 2=High/512
//                      for whenever that's reintroduced
//   message         - array of MESSAGES entries shown as a compatibility
//                      warning before boot (see getCompatibilityMessage())
const GAME_SETTINGS = {
  // 1080 Snowboarding - doesn't render correctly under the WebGL2/GLES3
  // build. Separately, any internal upscaling (EnableNativeResFactor above
  // "1") introduces its own graphical glitch on this title - confirmed via
  // isolated bisection testing, not related to the WebGL2 issue.
  '632c98cf281cda776e66685b278a4fa6': { useGles2: true, nativeResFactor: '1' }, // Europe
  'f58b3055a2c642fb2f563f11b6b597ea': { useGles2: true, nativeResFactor: '1' }, // Europe
  'fa27089c425dbab99f19245c5c997613': { useGles2: true, nativeResFactor: '1' }, // Japan, USA
  '18381c8f37e2b29f5940eea9b5f96814': { useGles2: true, nativeResFactor: '1' }, // Japan, USA

  // Pokemon Snap - doesn't render correctly under the default WebGL2/GLES3
  // build.
  'e5a0ca3dc54b38ea7fcd927e3cffad3b': { useGles2: true }, // Australia
  'f2a8106403d2bf9350bfeab08689d54a': { useGles2: true }, // Europe
  'e9028f9ccc307806695dd81742d05d5d': { useGles2: true }, // France
  '144b8906dc40534cfbef6d7b994a982b': { useGles2: true }, // Germany
  '8e1968191dd27655c03be812cf041a95': { useGles2: true }, // Italy
  'a45d7115be5a06fd1567f9f913c3bdf8': { useGles2: true }, // Spain
  'fc3c9329b7cdd67cf7650abf63b9a580': { useGles2: true }, // USA

  // StarCraft 64 - title screen uses a render-to-texture background
  // technique that renders incorrectly on this core's WASM build (root
  // cause unknown - see project_starcraft64_corruption_investigation
  // memory). Framebuffer emulation is force-disabled to trade the
  // corrupted title screen for a blank one instead. With useGles2 added,
  // the credits screen now renders correctly (previously also blank) -
  // various in-game graphical glitches remain, but the game is playable.
  '72b60fac5ee257fa387b43c57632d50c': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // Australia
  '6079eb12ca73f28a4579d249de09706f': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // Australia
  '356a5d3d59e0adef6efae6096fc20f77': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // Germany (Proto)
  'af48bf8de3c63f37e5edd6a382aeaa1f': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // Germany (Proto)
  '559f71b861f639b6376d891e3023414b': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // USA
  'fcb1ede6d4f63dff012ce8c2e62e95cf': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // USA
  '3eb732a8d004263ad8eb0da59a29582a': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // USA (Beta)
  'a955e7f0c08dc43e98bef99c005bae1c': { useGles2: true, fbEmulation: false, message: [M.blankTitle, M.graphicalIssues] }, // USA (Beta)

  // Star Wars Episode I: Battle for Naboo - countPerOp: 2 for a
  // performance boost. Ported over from the editor's old mappings/n64.js
  // (now removed - this core controls its own per-title tweaks). That
  // entry also paired this with audioLatency: 2, intentionally not
  // carried over here - audio latency tuning is being re-tested from
  // scratch to see if it's actually necessary before reintroducing it.
  '0bd1f7bb9f4b02520e4e9285c809f099': { countPerOp: 2 }, // Europe
  '415a266c6dff65350fd577a127a2d601': { countPerOp: 2 }, // Europe
  '3cb88b934572e7520f35e5458798775b': { countPerOp: 2 }, // USA
  'abc8665fc1a2c76ff61394aea0dad6c3': { countPerOp: 2 }, // USA

  // Mario Tennis and Jet Force Gemini (Star Twins) periodic-freeze/crash
  // entries removed - root cause (unbounded program_uniforms[] array in
  // libretro-common/glsm/glsm.c, hit once a session compiles >1024 distinct
  // GL shader programs) fixed and confirmed resolved for both games.
  // See project_n64_debug_symbols_root_cause memory for details.
};

const getGameSettings = (md5) => GAME_SETTINGS[md5] || {};

const getCompatibilityMessage = (md5) => {
  const msgs = getGameSettings(md5).message;
  if (msgs) {
    let retMsg = 'This game has known compatibility issues.';
    let first = true;
    msgs.forEach((msg) => {
      retMsg += '\n' + (first ? '"' + msg + '"' : msg);
      first = false;
    });
    return retMsg;
  }
  return null;
};

export { getCompatibilityMessage, getGameSettings };
