import {
  RetroAppWrapper,
  DisplayLoop,
  LOG,
  Controller,
  Controllers,
  KeyCodeToControlMapping,
  KCODES,
  CIDS,
  md5Uint8Array,
} from '@webrcade/app-common';

import { getCompatibilityMessage, getGameSettings } from './compat';

// getScriptUrl()/onWriteAdditionalFiles() consult compat.js's per-title
// GAME_SETTINGS table (useGles2, nativeResFactor, fbEmulation, etc.) - add
// a new per-game tweak there, not a new one-off MD5 list/const here.
//
// getScriptUrl() needs the ROM's MD5 (for useGles2 below), but it normally
// runs before the ROM is fetched (app-common's retro/index.js:280 calls
// loadEmscriptenModule() before the ROM is fetched), so
// loadEmscriptenModule()/setRoms() are overridden below to defer the
// actual module load until setRoms() has the MD5 in hand - entirely
// within this app, no app-common changes.

const UP = 0x0001;
const DOWN = 0x0002;
const LEFT = 0x0004;
const RIGHT = 0x0008;
const START = 0x0010;
const R_KEY = 0x0020;
const L_KEY = 0x0040;
const Z_KEY = 0x0080;
const A_KEY = 0x0100;
const B_KEY = 0x0200;
const CL_KEY = 0x0400;
const CR_KEY = 0x0800;
const CU_KEY = 0x1000;
const CD_KEY = 0x2000;

const ANALOG_BIT = 0x8000;
const ANALOG_UP = ANALOG_BIT | CIDS.UP;
const ANALOG_DOWN = ANALOG_BIT | CIDS.DOWN;
const ANALOG_LEFT = ANALOG_BIT | CIDS.LEFT;
const ANALOG_RIGHT = ANALOG_BIT | CIDS.RIGHT;

const C_BIT = 0x4000;
const C_UP = C_BIT | CIDS.UP;
const C_DOWN = C_BIT | CIDS.DOWN;
const C_LEFT = C_BIT | CIDS.LEFT;
const C_RIGHT = C_BIT | CIDS.RIGHT;

const ANALOG_50 = 0x2000;
const ANALOG_25 = 0x1000;

class N64KeyCodeToControlMapping extends KeyCodeToControlMapping {
  constructor() {
    super({
      [KCODES.ENTER]: CIDS.START,
      [KCODES.ESCAPE]: CIDS.ESCAPE,
      [KCODES.ARROW_UP]: ANALOG_UP,
      [KCODES.ARROW_DOWN]: ANALOG_DOWN,
      [KCODES.ARROW_RIGHT]: ANALOG_RIGHT,
      [KCODES.ARROW_LEFT]: ANALOG_LEFT,
      [KCODES.C]: CIDS.LBUMP, // L button
      [KCODES.V]: CIDS.RBUMP, // R button
      [KCODES.Z]: CIDS.X, // B Button
      [KCODES.X]: CIDS.A, // A button
      [KCODES.SPACE_BAR]: CIDS.RTRIG, // Z button
      [KCODES.W]: C_UP, // D-pad (up)
      [KCODES.A]: C_LEFT, // D-pad (left)
      [KCODES.S]: C_DOWN, // D-pad (down)
      [KCODES.D]: C_RIGHT, // D-pad (right)
      [KCODES.I]: CIDS.UP, // C-pad (up)
      [KCODES.J]: CIDS.LEFT, // C-pad (left)
      [KCODES.K]: CIDS.DOWN, // C-pad (down)
      [KCODES.L]: CIDS.RIGHT, // C-pad (right)
      [KCODES.CONTROL_RIGHT]: ANALOG_50, // Analog 50%
      [KCODES.CONTROL_LEFT]: ANALOG_50, // Analog 50%
      [KCODES.SHIFT_RIGHT]: ANALOG_25, // Analog 25%
      [KCODES.SHIFT_LEFT]: ANALOG_25, // Analog 25%
    });
  }
}

export class Emulator extends RetroAppWrapper {

  GAME_SRAM_NAME = 'game.srm';
  SAVE_NAME = 'sav';

  constructor(app, debug = false) {
    super(app, debug);
    window.emulator = this;

    // N64's control stick is separate from the D-pad - don't let stick
    // motion also generate D-pad bits.
    this.analogMode = true;
  }

  getHashFileExtension() {
    return 'n64';
  }

  // getScriptUrl() needs to know the ROM's MD5 (for the 1080 Snowboarding
  // GLES2 override below), but it normally runs before the ROM is fetched.
  // Deferring the actual Emscripten module load from loadEmscriptenModule()
  // (called too early, by app-common) to setRoms() (called once the ROM -
  // and its MD5 - are known) fixes that. onStart() awaits the real load
  // before doing anything that needs window.Module/FS.
  async loadEmscriptenModule(canvas) {
    this._pendingCanvas = canvas;
    return Promise.resolve();
  }

  setRoms(uid, frontendArray, biosBuffers, romBytes, ext) {
    super.setRoms(uid, frontendArray, biosBuffers, romBytes, ext);

    // Also used by onStart() for the compat-message check and by
    // onWriteAdditionalFiles() for the StarCraft 64 FB-emulation override -
    // computed once here so all three stay in sync off one MD5.
    this._romMd5 = romBytes ? md5Uint8Array(romBytes) : null;

    if (!this._emscriptenLoadPromise) {
      this._emscriptenLoadPromise = super.loadEmscriptenModule(this._pendingCanvas);
    }
  }

  // Warn on known compatibility issues before starting - see compat.js.
  async onStart(canvas) {
    const { app } = this;

    await this._emscriptenLoadPromise;

    if (this._romMd5) {
      const compatMsg = getCompatibilityMessage(this._romMd5);
      if (compatMsg) {
        await new Promise((resolve) => {
          app.yesNoPrompt({
            header: 'Compatibility Issues',
            message: compatMsg,
            prompt: 'Do you still wish to continue?',
            onYes: () => {
              // YesNoScreen's own close() is a no-op here (app-common's
              // renderYesNoScreen() doesn't pass it a closeCallback, so
              // there's nothing for close() to call) - explicitly reset
              // mode ourselves instead of relying on it.
              app.setModeToLoaded();
              resolve();
            },
            onNo: () => {
              app.setModeToLoaded();
              app.exit();
            },
          });
        });
      }
    }

    await super.onStart(canvas);
  }

  getScriptUrl() {
    return getGameSettings(this._romMd5).useGles2 === true
      ? 'js/mupen64plus_next_libretro_gles2.js'
      : 'js/mupen64plus_next_libretro.js';
  }

  getPrefs() {
    return this.prefs;
  }

  createControllers() {
    this.keyToControlMapping = new N64KeyCodeToControlMapping();
    return new Controllers([
      new Controller(this.keyToControlMapping),
      new Controller(),
      new Controller(),
      new Controller(),
    ]);
  }

  // GLideN64 needs a real GL context, and we don't have real pthreads in
  // this WASM build, so keep the renderer single-threaded.
  // WRC - audio_latency intentionally not set here for now (was tuned
  // per-game via the editor's old disableOpenGL2/audioLatency props,
  // now removed - see compat.js). Testing from a clean slate (core's own
  // default) to see whether tuning it was ever actually necessary before
  // reintroducing it, here or in compat.js's GAME_SETTINGS.
  getRaConfigContents() {
    return (
      // "video_threaded = \"true\"\n" +
      "video_vsync = \"false\"\n" +
      // "video_driver = \"gl\"\n" +
      // "video_driver = \"null\"\n" +
      "audio_latency = \"256\"\n" +
      "audio_buffer_size = \"16384\"\n"
      // "audio_sync = \"false\"\n"
      // "audio_driver = \"rwebaudio\"\n"
      // "audio_driver = \"null\"\n"

      // "audio_latency = \"64\"\n" +
      // "audio_buffer_size = \"8192\"\n" +
      // "audio_sync = \"false\"\n"
      // "audio_rate_control  = \"false\"\n" +
      // "audio_resampler   = \"nearest\"\n"
    );
  }

  // Per-core options (mupen64plus-<key>) - written to
  // config/Mupen64Plus-Next/Mupen64Plus-Next.opt, matching the core's
  // retro_get_system_info() library_name. No dynarec (not viable in WASM
  // sandboxing). Real pthreads were tried (Makefile.emscripten
  // .mupen64plus-next PTHREAD=1 + EMULATORJS_THREADS=1) with
  // ThreadedRenderer=True - the black-screen/deadlock was fixed (stale
  // retro_savestate_complete flag from ROM load defeating GLideN64's
  // commandLoop() yield check), but the real-pthread build measured out
  // slower than this single-threaded coroutine renderer, likely from Web
  // Worker/SharedArrayBuffer/Atomics overhead. Reverted; left False.
  async onWriteAdditionalFiles() {
    await super.onWriteAdditionalFiles();

    const { FS } = window;

    // See compat.js's GAME_SETTINGS table for what each of these keys does
    // and why a given title needs it - add a new per-game tweak there, not
    // a new one-off MD5 check/const here.
    const gameSettings = getGameSettings(this._romMd5);

    // 0 (disabled) means "no explicit value" - the core falls back to its
    // own per-game database (or 2 if the game isn't in it), so the option
    // is simply left out of the file rather than writing a literal "0".
    const countPerOp = gameSettings.countPerOp || 0;

    const opt =
      'mupen64plus-rdp-plugin = "gliden64"\n' +
      'mupen64plus-rsp-plugin = "hle"\n' +
      'mupen64plus-cpucore = "cached_interpreter"\n' +
      'mupen64plus-EnableCopyColorToRDRAM = "Off"\n' +
      'mupen64plus-EnableCopyDepthToRDRAM = "Off"\n' +
      'mupen64plus-EnableFragmentDepthWrite = "True"\n' +
      'mupen64plus-next-EnableInaccurateTextureCoordinate = "True"\n' +
      'mupen64plus-next-EnableLegacyBlending = "True"\n' +
      'mupen64plus-HybridFilter = "False"\n' +
      (gameSettings.fbEmulation === false ? 'mupen64plus-EnableFBEmulation = "False"\n' : '') +
      (gameSettings.nativeResFactor ? `mupen64plus-EnableNativeResFactor = "${gameSettings.nativeResFactor}"\n` : '') +
      (countPerOp >= 1 ? `mupen64plus-CountPerOp = "${countPerOp}"\n` : '')

    try { FS.mkdir('/home/web_user/retroarch/userdata/config/Mupen64Plus-Next'); } catch (e) {}
    try {
      FS.writeFile(
        '/home/web_user/retroarch/userdata/config/Mupen64Plus-Next/Mupen64Plus-Next.opt',
        opt,
      );
      LOG.info('Wrote Mupen64Plus-Next.opt');
    } catch (e) {
      LOG.error('Error writing Mupen64Plus-Next.opt: ' + e);
    }
  }

  async saveState() {
    const { saveStatePath, started } = this;
    const { FS, Module } = window;

    try {
      if (!started) {
        return;
      }

      // Save to files
      Module._cmd_savefiles();

      let path = '';
      const files = [];
      let s = null;

      path = `/home/web_user/retroarch/userdata/saves/${this.GAME_SRAM_NAME}`;
      LOG.info('Checking: ' + path);
      try {
        s = FS.readFile(path);
        if (s) {
          LOG.info('Found save file: ' + path);
          let hasData = false;
          for (let i = 0; i < s.length; i++) {
            if (s[i] !== 0xFF) {
              hasData = true;
              break; // exit early
            }
          }

          if (hasData) {
            LOG.info('File has content: ' + path);
            files.push({
              name: this.SAVE_NAME,
              content: s,
            });
          } else {
            LOG.info('Skipping empty file: ' + path);
          }
        }
      } catch (e) {}

      if (files.length > 0) {
        if (await this.getSaveManager().checkFilesChanged(files)) {
          await this.getSaveManager().save(
            saveStatePath,
            files,
            this.saveMessageCallback,
          );
        }
      } else {
        await this.getSaveManager().delete(path);
      }
    } catch (e) {
      LOG.error('Error persisting save state: ' + e);
    }
  }

  async loadState() {
    const { saveStatePath } = this;
    const { FS } = window;

    // Write the save state (if applicable)
    try {
      // Load
      const files = await this.getSaveManager().load(
        saveStatePath,
        this.loadMessageCallback,
      );

      if (files) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.name === this.SAVE_NAME) {
            LOG.info(`writing ${this.GAME_SRAM_NAME} file`);
            FS.writeFile(
              `/home/web_user/retroarch/userdata/saves/${this.GAME_SRAM_NAME}`,
              f.content,
            );
          }
        }

        // Cache the initial files
        await this.getSaveManager().checkFilesChanged(files);
      }
    } catch (e) {
      LOG.error('Error loading save state: ' + e);
    }
  }

  isEscapeHackEnabled() {
    return false;
  }

  applyGameSettings() {}

  isForceAspectRatio() {
    return false;
  }

  getUseNewResizeStyle() {
    return true;
  }

  getUseNativeMainLoop() {
    return false;
  }

  getDefaultAspectRatio() {
    return 1.333;
  }

  resizeScreen(canvas) {
    this.canvas = canvas;
    this.updateScreenSize();
  }

  createDisplayLoop(debug) {
    const loop = new DisplayLoop(
      60,
      false, // vsync
      debug, // debug
      true,
      true
    );
    loop.setAdjustTimestampEnabled(true);
    return loop;
  }

  getShotAspectRatio() { return this.getDefaultAspectRatio(); }

  pollControls() {
    const { controllers, keyToControlMapping } = this;

    controllers.poll();

    if (
      controllers.isControlDown(0, CIDS.LTRIG) ||
      controllers.isControlDown(0, CIDS.LANALOG) ||
      controllers.isControlDown(0, CIDS.RANALOG)
    ) {
      this.escapeCount = this.escapeCount === -1 ? 0 : this.escapeCount + 1;
    } else {
      this.escapeCount = -1;
    }

    for (let i = 0; i < 4; i++) {
      let input = 0;
      let axisX = 0;
      let axisY = 0;

      // Hack to reduce likelihood of accidentally bringing up menu
      if (
        controllers.isControlDown(0 /*i*/, CIDS.ESCAPE) &&
        (this.escapeCount === -1 || this.escapeCount < 60)
      ) {
        if (this.pause(true)) {
          controllers
            .waitUntilControlReleased(0 /*i*/, CIDS.ESCAPE)
            .then(() => this.showPauseMenu());
          return;
        }
      }
      if (controllers.isControlDown(i, CIDS.UP, false)) {
        input |= UP;
      } else if (controllers.isControlDown(i, CIDS.DOWN, false)) {
        input |= DOWN;
      }
      if (controllers.isControlDown(i, CIDS.RIGHT, false)) {
        input |= RIGHT;
      } else if (controllers.isControlDown(i, CIDS.LEFT, false)) {
        input |= LEFT;
      }
      if (controllers.isControlDown(i, CIDS.START)) {
        input |= START;
      }
      if (controllers.isControlDown(i, CIDS.A)) {
        input |= A_KEY;
      }
      if (controllers.isControlDown(i, CIDS.X)) {
        input |= B_KEY;
      }
      if (controllers.isControlDown(i, CIDS.LBUMP)) {
        input |= L_KEY;
      }
      if (controllers.isControlDown(i, CIDS.RBUMP)) {
        input |= R_KEY;
      }
      if (
        controllers.isControlDown(i, CIDS.LTRIG) ||
        controllers.isControlDown(i, CIDS.RTRIG)
      ) {
        input |= Z_KEY;
      }
      if (controllers.isAxisLeft(i, 1) ||
        (i === 0 && keyToControlMapping.isControlDown(C_LEFT))) {
        input |= CR_KEY;
      }
      if (controllers.isAxisRight(i, 1) ||
        (i === 0 && keyToControlMapping.isControlDown(C_RIGHT))) {
        input |= CL_KEY;
      }
      if (controllers.isAxisUp(i, 1) ||
        (i === 0 && keyToControlMapping.isControlDown(C_UP))) {
        input |= CU_KEY;
      }
      if (controllers.isAxisDown(i, 1) ||
        (i === 0 && keyToControlMapping.isControlDown(C_DOWN))) {
        input |= CD_KEY;
      }
      axisX = (controllers.getAxisValue(i, 0, true) /** 0x7fff*/);
      axisY = (controllers.getAxisValue(i, 0, false) /** 0x7fff*/);

      if (i === 0) {
        let multiplier = 1;
        if (keyToControlMapping.isControlDown(ANALOG_50) ||
          keyToControlMapping.isControlDown(ANALOG_25)) {
          if (keyToControlMapping.isControlDown(ANALOG_50)) {
            multiplier -= 0.50;
          }
          if (keyToControlMapping.isControlDown(ANALOG_25)) {
            multiplier -= 0.25;
          }
        }

        if (keyToControlMapping.isControlDown(ANALOG_RIGHT)) {
          axisX = (multiplier /** 0x7fff*/);
        }
        if (keyToControlMapping.isControlDown(ANALOG_LEFT)) {
          axisX = (-multiplier /** 0x7fff*/);
        }
        if (keyToControlMapping.isControlDown(ANALOG_UP)) {
          axisY = (-multiplier /** 0x7fff*/);
        }
        if (keyToControlMapping.isControlDown(ANALOG_DOWN)) {
          axisY = (multiplier /** 0x7fff*/);
        }
      }
      this.sendInput(i, input, axisX, axisY, 0, 0);
    }
  }
}
