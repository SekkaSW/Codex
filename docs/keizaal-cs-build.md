# Community Shaders 1.6.1 - experimental Keizaal build

This branch is an isolated Windows build harness. Do not merge it into main. It does not modify or execute Codex's bot code.

## Purpose and limits

Build upstream Community Shaders from commit `9850f24b0292daa462d7cdb92916a66ded350878` (version 1.6.1), with one source-level change: on non-VR Skyrim, do not explicitly load EngineFixes.dll or register its absence as a startup error. Preserve every other dependency check and CS initialization path. VR behavior is unchanged.

This is NOT a verified fix for Keizaal input, browser, voice, rendering, or shutdown crashes. Removing the requirement permits those features to be tested with CS actually running; previously, stock CS disabled itself when Engine Fixes was absent. The build does NOT supply Engine Fixes' bug fixes or establish that CS is supported without them. It is not the earlier binary string-edit experiment and does not load a substitute DLL.

## Build

The branch-scoped workflow in `.github/workflows/keizaal-cs-build.yml` runs on push to this branch. It checks out the pinned upstream source and its submodules, verifies the source blob, applies the change, uses upstream's Windows build-environment setup, and builds the Release `CommunityShaders` target with matching debug symbols. The token has read-only repository permissions; no repository secrets, game files, save files, or logs are used. The job has a timeout and cannot deploy to a computer or merge into main.

A successful run publishes a DLL/PDB artifact and the source patch/provenance. A failed run publishes diagnostics only; it must not be described as a completed DLL.

## Test installation (only after a successful build)

1. Close Skyrim, the launcher, and Vortex. Back up the exact installed CommunityShaders.dll outside the game directory.
2. Use the original matching Community Shaders 1.6.1 resources. This is a DLL-only replacement, not an all-in-one mod package; do not combine it with assets from a different CS release or fork.
3. Replace only `Data\SKSE\Plugins\CommunityShaders.dll` with the source-built DLL; its matching PDB can accompany it. Do not put the original backup DLL in SKSE's plugin directory under another .dll filename.
4. Keep EngineFixes.dll disabled for this experimental comparison. Do not alter the current preloader, Keizaal components, plugin order, or unrelated settings during this test.
5. Start a fresh process. Confirm the End menu and CS rendering actually operate, then test F1 names, X interactions, owner labels, voice, jobs, and normal exit.
6. Inspect CommunityShaders.log for the experimental-build marker and for any other startup errors. A missing warning alone is not proof of working rendering.
7. If the browser or interactions fail, or a crash occurs, stop and restore the backed-up original DLL. With stock CS and no Engine Fixes, CS may disable itself; that is not a successful CS-plus-Keizaal configuration.

## Sources

- https://github.com/community-shaders/skyrim-community-shaders/tree/9850f24b0292daa462d7cdb92916a66ded350878
- https://github.com/community-shaders/skyrim-community-shaders/blob/9850f24b0292daa462d7cdb92916a66ded350878/src/XSEPlugin.cpp
- https://github.com/community-shaders/skyrim-community-shaders/blob/9850f24b0292daa462d7cdb92916a66ded350878/.github/actions/setup-build-environment/action.yaml

Original upstream licensing applies. The artifact includes its license notices, the exact patch and modified source file, build instructions, hashes, and the pinned upstream source and submodule identifiers. No user-uploaded files or proprietary Skyrim files are published.
