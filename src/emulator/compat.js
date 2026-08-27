// Per-ROM (MD5) known-issue warnings for THIS core specifically
// (mupen64plus-next / GLideN64) - unlike webrcade-app-retro-parallel-n64's
// compat.js (ported from the older N64Wasm-era core and not yet
// re-verified here), these entries are observed directly on this core.
const MESSAGES = {
  periodicFreeze: 'Periodically freezes.',
  graphicalIssues: 'Graphical issues.',
  blankMenus: 'Title screen and credits render blank, gameplay unaffected.',
};

const M = MESSAGES;

// StarCraft 64's title/menu screens use a render-to-texture background
// technique that renders incorrectly on this core's WASM build (root cause
// unknown - see project_starcraft64_corruption_investigation memory).
// Framebuffer emulation is force-disabled for this ROM in index.js to trade
// the corrupted screens for blank ones instead - gameplay itself is fine.
// Also used directly by index.js (not just for this message) so both stay
// in sync off one hash list.
const STARCRAFT_64_MD5S = [
  '72b60fac5ee257fa387b43c57632d50c', // Australia
  '6079eb12ca73f28a4579d249de09706f', // Australia
  '356a5d3d59e0adef6efae6096fc20f77', // Germany (Proto)
  'af48bf8de3c63f37e5edd6a382aeaa1f', // Germany (Proto)
  '559f71b861f639b6376d891e3023414b', // USA
  'fcb1ede6d4f63dff012ce8c2e62e95cf', // USA
  '3eb732a8d004263ad8eb0da59a29582a', // USA (Beta)
  'a955e7f0c08dc43e98bef99c005bae1c', // USA (Beta)
];

const ISSUES = {
  // Mario Tennis and Jet Force Gemini (Star Twins) periodic-freeze/crash
  // entries removed - root cause (unbounded program_uniforms[] array in
  // libretro-common/glsm/glsm.c, hit once a session compiles >1024 distinct
  // GL shader programs) fixed and confirmed resolved for both games.
  // See project_n64_debug_symbols_root_cause memory for details.

  ...Object.fromEntries(STARCRAFT_64_MD5S.map((md5) => [md5, [M.blankMenus]])),
};

const getCompatibilityMessage = (md5) => {
  const msgs = ISSUES[md5];
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

export { getCompatibilityMessage, STARCRAFT_64_MD5S };
