# AGENTS.md - System Rules & Pre-Flight Checklist for AI Coding Assistants

> **CRITICAL FOR LLMs / AGENTS (Claude, Copilot, Gemini, Cursor):**
> You are operating within the **ROCKNIX** repository. You MUST strictly follow the directives and pre-flight checklist below before generating code, inline comments, or Pull Request descriptions.

---

## 1. Core Operating Directives

### A. Code & PR Verbosity
* **DO NOT** write verbose explanations, conversational narrative, or repetitive summaries in PR descriptions.
* **DO NOT** add obvious, noisy, or redundant inline code comments.
* **DO** keep all code human-readable, minimal, and clean.

### B. Directory Structure & Package Policy
* **DO NOT** modify `package.mk` files directly under the top-level `packages/` directory.
* **DO** place or modify `package.mk` files strictly within:
  * `projects/ROCKNIX/devices/*/packages` (for device-specific package overrides)
  * `projects/ROCKNIX/packages` (for project-wide package definitions)

### C. Pull Request Scope & Architecture
* **DO NOT** split related changes into parallel PRs. Group all changes sharing a single purpose into one PR.
* **DO NOT** write zero-shot kernel modules without prior context, upstream references, or existing examples.
* **DO NOT** modify `mkimage` scripts to create custom images for individual devices.
* **DO NOT** write direct in-tree patches to the Linux kernel or core libraries.
* **DO** isolate all device-specific behaviors and modifications into quirk files.
* **DO** reference upstream sources and pull them in dynamically at the build root.
* **DO** cross-test any kernel edits on multiple target devices to prevent regressions.

### D. Requirements & Artifacts
* **DO** hold the human contributor fully accountable for understanding and validating all code you produce.
* **DO** require compiled build artifacts (`.img.gz` and `.tar` files) attached/linked in the PR description for all affected target devices.

---

## 2. Mandatory LLM Pre-Flight Checklist

Before outputting code or finalizing a PR description, you **MUST** run your output through this self-review checklist for at least **2 iterative passes**.

## 3. HX90 / RG34XX Build and Flash Notes

* `hx90` is the remote build host. Build and flash artifacts are under `~/development/rocknix/target/`.
* The handheld for this project is an Anbernic RG34XX and its known-good memory variant is DDR4. Prefer the matching `ROCKNIX-H700.*-DDR4.img.gz` artifact. Do not infer the RAM type from a stale card's device-tree overlay alone: an older card showed a DDR3 overlay, while `~/Downloads/ROCKNIX-H700.aarch64-20261001-DDR4.img.gz` records the known DDR4 variant.
* The RG34XX boot device tree is `sun50i-h700-anbernic-rg34xx.dtb`. In `projects/ROCKNIX/config.xml`, the DDR4 image uses that FDT without the DDR3-only `sun50i-h700-anbernic-rg35xx-2024-ddr3.dtbo` overlay. Keep device-tree selection and RAM/U-Boot variant as separate checks.
* Before flashing, identify the TF card by `lsblk` (removable flag, capacity, model, and current partitions), ensure it is not mounted, and confirm it is not a host disk. Write the decompressed image to the whole card device (for example `/dev/sdX`, not a partition), wait for `conv=fsync` to finish, then read back and compare the image bytes before ejecting.
* If the kernel reports `Data phase error` or block I/O errors during a flash, treat the card as unverified even if `dd` copied all bytes into cache. Wait for the write process to exit; then retry with a different reader/USB port or card and require a clean read-back comparison.
* A device-tree or boot-file override may be required for a particular board revision. Find and verify the exact file from the known-good card/backup or project records before flashing; do not guess or substitute a similarly named overlay. Record the override and its source here once identified.

## 4. Sibling Repositories

* `~/development/heya` is the heya launcher source (branch `master`, remote `iamcheyan/heya`). `projects/ROCKNIX/packages/apps/heya/package.mk` pins a commit plus archive SHA-256, so edit the Go code there and bump the pin; never edit a vendored copy.
* heya Go work uses `/usr/local/go/bin/go` and `/usr/local/go/bin/gofmt`. `go` is not on `PATH`.
* `~/development/sonata` is no longer part of the H700 image. Sonata was removed from the package set and from the heya app list.
* heya tests that touch background jobs need a sleep before `Poll()`; a hot poll loop starves the worker goroutine on a single-CPU host.
* Update the heya pin only after `git push` succeeds: GitHub serves no archive for an unpushed commit, so `PKG_URL` would 404.

## 5. H700 Service Toggles

* `projects/ROCKNIX/packages/rocknix/config/system/configs/system.cfg` holds every service switch as `*.enabled`: `adbd`, `avahi`, `ftp`, `http`, `rsyncd`, `samba`, `syncthing`, `telnet`, `ssh`.
* `rocknix-services` (`/usr/bin`) is the only writer: `list`, `status KEY`, `start`/`stop`/`toggle KEY`, `set KEY on|off`.
* Boot order: `098-devservices` starts what is enabled, then the existing `099-networkservices` stops the rest.
* heya reaches the same switches with `heya-control service KEY on|off|toggle|status`; labels come from `/usr/share/heya/settings/services.conf`.
* `/storage/.config/system/configs` is excluded from the upgrade sync, so `sources/post-update` copies only the `*.enabled` keys a card is missing; a saved choice is never overwritten.
