"""Apply one guarded source edit to the pinned CS release; never patch DLL bytes."""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
from pathlib import Path
import subprocess

UPSTREAM_COMMIT = "9850f24b0292daa462d7cdb92916a66ded350878"
EXPECTED_SOURCE_BLOB = "e3875cb23c1532175f3a854438b18f7fe2a71653"
MARKER = "Keizaal compatibility EXPERIMENT"


def git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(root), *args])


def apply(root: Path, output: Path) -> None:
    root = root.resolve()
    output = output.resolve()
    commit = git(root, "rev-parse", "HEAD").decode().strip()
    if commit != UPSTREAM_COMMIT:
        raise RuntimeError(f"Unexpected upstream commit: {commit}")
    blob = git(root, "rev-parse", "HEAD:src/XSEPlugin.cpp").decode().strip()
    if blob != EXPECTED_SOURCE_BLOB:
        raise RuntimeError(f"Unexpected source blob: {blob}")

    path = root / "src" / "XSEPlugin.cpp"
    original_bytes = git(root, "show", "HEAD:src/XSEPlugin.cpp")
    original = original_bytes.decode("utf-8").replace("\r\n", "\n")
    current = path.read_bytes().decode("utf-8").replace("\r\n", "\n")
    if current != original:
        raise RuntimeError("XSEPlugin.cpp already differs from the pinned original")

    old = '''\t} else {
\t\tif (!LoadLibrary(L"Data/SKSE/Plugins/EngineFixes.dll")) {
\t\t\tpushMissingDllError(stl::utf16_to_utf8(L"Data/SKSE/Plugins/EngineFixes.dll").value_or("<unicode conversion error>"s));
\t\t}
\t}'''
    new = '''\t} else {
\t\t// Experimental non-VR build: skip only the Engine Fixes startup dependency.
\t\t// This does not provide its bug fixes or establish compatibility with Keizaal.
\t\tlogger::warn("Keizaal compatibility EXPERIMENT: EngineFixes.dll is not required or loaded by this non-VR CS build; all other dependency checks remain enabled.");
\t}'''
    if original.count(old) != 1:
        raise RuntimeError("Expected exactly one matching non-VR Engine Fixes block")
    modified = original.replace(old, new, 1)
    if modified.replace(new, old, 1) != original:
        raise RuntimeError("Patch round-trip validation failed")
    for invariant in ("Hooks::InstallEarlyHooks();", "Deferred::Hooks::Install();", "Hooks::Install();", "globals::OnDataLoaded();", "shaderCache->menuLoaded = true;", "EngineFixesVR.dll", "incompatibleDLLs"):
        if modified.count(invariant) != original.count(invariant):
            raise RuntimeError(f"Unexpected modification of {invariant}")

    path.write_bytes(modified.encode("utf-8"))
    output.mkdir(parents=True, exist_ok=True)
    (output / "XSEPlugin.original.cpp").write_bytes(original_bytes)
    (output / "XSEPlugin.cpp").write_bytes(modified.encode("utf-8"))
    diff = "".join(difflib.unified_diff(original.splitlines(keepends=True), modified.splitlines(keepends=True), fromfile="a/src/XSEPlugin.cpp", tofile="b/src/XSEPlugin.cpp"))
    (output / "engine-fixes-optional.patch").write_text(diff, encoding="utf-8")
    submodules = git(root, "submodule", "status", "--recursive").decode("utf-8")
    if any(line.startswith(("-", "+", "U")) for line in submodules.splitlines()):
        raise RuntimeError("Submodule checkout does not match pinned source")
    (output / "submodules.txt").write_text(submodules, encoding="utf-8")
    data = {
        "upstream_repository": "https://github.com/community-shaders/skyrim-community-shaders",
        "upstream_commit": commit,
        "upstream_version": "1.6.1",
        "original_source_blob": blob,
        "original_source_sha256": hashlib.sha256(original_bytes).hexdigest(),
        "modified_source_sha256": hashlib.sha256(modified.encode("utf-8")).hexdigest(),
        "scope": "Only non-VR Engine Fixes explicit loading and missing-dependency reporting; no DLL string editing",
        "runtime_tested": False,
        "engine_fixes_bug_fixes_reimplemented": False,
    }
    (output / "source-provenance.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    changed = git(root, "diff", "--name-only").decode().splitlines()
    if changed != ["src/XSEPlugin.cpp"]:
        raise RuntimeError(f"Unexpected changed upstream files: {changed}")
    print(diff)
    print("Validated: only the intended source file changed; normal initialization remains intact.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    apply(arguments.source, arguments.output)
