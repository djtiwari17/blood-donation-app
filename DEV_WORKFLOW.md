# Mobile Dev Workflow

Stop burning EAS build credits for every JS change. Only **native** changes need
a real rebuild — everything else is hot-reloadable.

## Starting a session from cold

```
# 1. Confirm the SDK toolchain is on PATH (new terminal windows pick this up
#    automatically; ANDROID_HOME / ANDROID_SDK_ROOT are set at the Windows
#    user-env level).
adb devices

# 2. If no device listed, start the emulator
emulator -list-avds
emulator -avd test_device

# 3. Start Metro
cd apps/mobile
npx expo start
```

Then either:
- **Expo Go** (recommended on this machine — see note below): the running
  Expo Go app on the device/emulator will show "Development servers" and list
  `http://localhost:8081` to connect to, or deep-link directly:
  ```
  adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
  ```
- **Custom dev client** (`expo-dev-client`, installed as of this session): run
  `npx expo start --dev-client` instead, and open the already-installed dev
  client app the same way.

## The rule: JS vs Native

| Change | Needs |
|---|---|
| Any `.ts`/`.tsx` file, styling, business logic, new screen | **Nothing** — Metro hot-reloads automatically |
| New/updated npm package that's pure JS | **Nothing** — just restart Metro |
| New native module, `app.json` plugin change, permission, package name, SDK bump | `npx expo run:android` (rebuilds native code locally, installs to the connected device — no EAS credits used) |
| Producing the signed APK to actually hand to a soft-launch tester | `eas build --profile soft-launch --platform android` (the only case that should touch EAS) |

`npx expo run:android --variant release` also produces an installable release
APK entirely locally, if you want to avoid EAS even for that last step.

## Setup already done (this session)

- `expo-dev-client` installed (`apps/mobile/package.json`)
- `eas.json` has a `development` profile (`developmentClient: true`) for building
  a dev client via EAS if you ever want to skip the local Gradle build
- Android SDK installed at `C:\Users\LENOVO\AppData\Local\Android\Sdk`, with
  `ANDROID_HOME` / `ANDROID_SDK_ROOT` set persistently (Windows user env) and
  platform-tools/emulator added to `PATH` — take effect in *new* terminal
  sessions only, not ones already running
- AVD `test_device` (Pixel 6, Android 14 / API 34, google_apis x86_64) exists
- A local debug dev-client build was produced once via `npx expo run:android`
  (confirms the native toolchain works end-to-end on this machine — the
  56-minute first build was Gradle downloading/compiling everything from
  scratch; incremental rebuilds after a native change should be much faster)

## Known issue on this machine: emulator instability

This machine has **7.9GB total RAM**. Running the emulator (~1.3-1.6GB),
Metro/Node (~700MB), and Claude Code itself concurrently pushes it into
sustained memory pressure, causing Android's own System UI / Pixel Launcher
processes to repeatedly ANR ("isn't responding") — confirmed even on a
**completely fresh emulator boot with nothing else running**, so this is a
configuration/hardware mismatch, not something caused by the app or Metro.

The underlying dev workflow itself is proven correct — Metro started cleanly,
and the app loaded and rendered its real login screen inside Expo Go before
the ANR loop made further interaction impractical.

**If you hit this again:**
- Test on a **physical Android device** instead of the emulator if one becomes
  available — dramatically lighter than emulation, no ANR risk, and is what
  soft-launch testers will actually use anyway.
- Or try a lighter AVD: smaller device profile (e.g. Pixel 4a instead of
  Pixel 6), older Android version (API 30/31 instead of 34), reduced RAM
  (`emulator -avd test_device -memory 1536`).
- Close Chrome / other apps before starting the emulator — freed ~500MB last
  time but wasn't sufficient on its own.
- Falling back to `eas build` for a given test remains a safe, always-working
  option if local emulation keeps being unreliable on this machine.
