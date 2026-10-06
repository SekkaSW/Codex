"""Package a successfully compiled DLL, symbols, exact source edit, and notices."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
from datetime import datetime, timezone


def inspect_pe(path: Path) -> dict:
    data = path.read_bytes()
    if data[:2] != b"MZ":
        raise RuntimeError("Output does not have a Windows executable header")
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe:pe + 4] != b"PE\x00\x00":
        raise RuntimeError("Invalid PE signature")
    machine, count = struct.unpack_from("<HH", data, pe + 4)
    optional_size, characteristics = struct.unpack_from("<HH", data, pe + 20)
    optional = pe + 24
    if machine != 0x8664 or struct.unpack_from("<H", data, optional)[0] != 0x20B:
        raise RuntimeError("Output is not a Windows x64 PE32+ binary")
    if not characteristics & 0x2000:
        raise RuntimeError("Output is not marked as a DLL")
    sections = []
    for i in range(count):
        pos = optional + optional_size + i * 40
        virtual_size, rva, raw_size, raw = struct.unpack_from("<IIII", data, pos + 8)
        sections.append((rva, max(virtual_size, raw_size), raw, raw_size))

    def offset(rva: int) -> int:
        for start, size, raw, raw_size in sections:
            delta = rva - start
            if 0 <= delta < size and delta < raw_size:
                return raw + delta
        raise RuntimeError(f"Unmapped PE address 0x{rva:X}")

    export_rva, export_size = struct.unpack_from("<II", data, optional + 112)
    if not export_rva or not export_size:
        raise RuntimeError("DLL has no export directory")
    directory = offset(export_rva)
    names_count = struct.unpack_from("<I", data, directory + 24)[0]
    names_rva = struct.unpack_from("<I", data, directory + 32)[0]
    names_offset = offset(names_rva)
    names = []
    for i in range(names_count):
        name = offset(struct.unpack_from("<I", data, names_offset + i * 4)[0])
        end = data.index(b"\x00", name)
        names.append(data[name:end].decode("ascii"))
    required = {"SKSEPlugin_Load", "SKSEPlugin_Query", "SKSEPlugin_Version"}
    if not required.issubset(names):
        raise RuntimeError(f"Missing SKSE exports: {sorted(required - set(names))}")
    if b"Keizaal compatibility EXPERIMENT" not in data:
        raise RuntimeError("Experimental source marker was not found in compiled DLL")
    return {"architecture": "x64", "pe_type": "PE32+ DLL", "exports": sorted(names), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def package(source: Path, harness: Path, provenance: Path, output: Path) -> None:
    source, harness, provenance, output = (p.resolve() for p in (source, harness, provenance, output))
    candidates = list((source / "build" / "ALL").rglob("CommunityShaders.dll"))
    candidates = [p for p in candidates if p.parent.name.lower() == "release" and "aio" not in [x.lower() for x in p.parts]]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected exactly one Release DLL, found: {candidates}")
    dll = candidates[0]
    pdb = dll.with_suffix(".pdb")
    if not pdb.is_file() or pdb.stat().st_size == 0:
        raise RuntimeError("Matching linker PDB is missing")
    inspection = inspect_pe(dll)
    binary = output / "DLL-PDB"
    evidence = output / "Source-Provenance"
    binary.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    shutil.copy2(dll, binary / "CommunityShaders.dll")
    shutil.copy2(pdb, binary / "CommunityShaders.pdb")
    for item in provenance.iterdir():
        if item.is_file():
            shutil.copy2(item, evidence / item.name)
    for item in (harness / "scripts" / "keizaal-cs-build").glob("*.py"):
        shutil.copy2(item, evidence / item.name)
    shutil.copy2(harness / ".github" / "workflows" / "keizaal-cs-build.yml", evidence / "keizaal-cs-build.yml")
    shutil.copy2(harness / "docs" / "keizaal-cs-build.md", evidence / "BUILD-AND-TEST.md")
    shutil.copy2(harness / "docs" / "keizaal-cs-build.md", binary / "README.md")
    for name in ("COPYING", "COPYING.txt", "LICENSE", "LICENSE.md", "EXCEPTIONS.md", "vcpkg.json", "vcpkg-configuration.json", "CMakePresets.json", ".gitmodules"):
        item = source / name
        if item.is_file():
            shutil.copy2(item, evidence / name.lstrip("."))
            if name.startswith(("COPYING", "LICENSE", "EXCEPTIONS")):
                shutil.copy2(item, binary / name)
    description = subprocess.check_output(["git", "-C", str(source), "describe", "--tags", "--dirty", "--always"], text=True).strip()
    manifest = {
        "built_at_utc": datetime.now(timezone.utc).isoformat(),
        "upstream_commit": "9850f24b0292daa462d7cdb92916a66ded350878",
        "source_description": description,
        "harness_commit": os.environ.get("GITHUB_SHA"),
        "workflow_run": os.environ.get("GITHUB_RUN_ID"),
        "configuration": "Release; ALL; AUTO_PLUGIN_DEPLOYMENT=OFF; BUILD_SHADER_TESTS=OFF",
        "dll": inspection,
        "pdb_sha256": hashlib.sha256(pdb.read_bytes()).hexdigest(),
        "validation": "PE structure, x64 architecture, required SKSE exports and marker checked; no Skyrim or multiplayer execution performed",
        "runtime_tested": False,
        "shader_tests_run": False,
    }
    for directory in (binary, evidence):
        (directory / "build-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (evidence / "SOURCE-ACCESS.txt").write_text(
        "Corresponding upstream source: https://github.com/community-shaders/skyrim-community-shaders/tree/9850f24b0292daa462d7cdb92916a66ded350878\n"
        "Clone that repository, checkout this commit, and run git submodule update --init --recursive.\n"
        "The included submodules.txt records the exact nested source revisions. Dependencies are pinned by upstream vcpkg manifests.\n"
        "Apply engine-fixes-optional.patch, or use the included guarded patch_source.py, then follow keizaal-cs-build.yml and BUILD-AND-TEST.md.\n"
        "This artifact includes the complete changed source file and original. No shader assets, logo assets, fonts, or user game files are redistributed.\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--harness", type=Path, required=True)
    parser.add_argument("--provenance", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    package(args.source, args.harness, args.provenance, args.output)
