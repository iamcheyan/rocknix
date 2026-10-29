# PocketShell System Information presentation redesign

## Baseline findings

The current boot guest does not contain a dedicated System Workspace page. `hello/main.tsx` renders the five terminal workspaces (`APPS`, `FILES`, `VIM`, `TOP`, `LOG`); workspace zero opens the launcher. The existing System Information surface is the Heya app manifest at `projects/ROCKNIX/packages/apps/heya/apps/system-info/app.json`, which runs `heya-tool system-info` and pages the `rocknix-info` output with `less`.

The requested page tabs (Tools/Monitor/SysInfo/Processes/Storage) are application entries in the existing launcher, not tabs inside a System page. The current Heya System Information tool is a static terminal report, with no local data persistence or separate UI route. Its existing source fields and tool operations are listed below.

## Existing data sources

| Information | Existing source | Verified target state and limitation |
| --- | --- | --- |
| Device, OS, kernel, hostname/IP, battery, CPU model/count/temperature/frequency, internal/external game storage, RAM available/capacity | `rocknix-info` on H700 | Verified live on the RG34XX. Values change while running; the formatter embeds no runtime values. |
| Device model | `rocknix-info` report | `DEVICE: Anbernic RG34XX`. |
| Hardware family | `rocknix-info` report | CPU string identifies Allwinner H700; device/build records identify this board as H700. |
| RAM variant | Not present in `rocknix-info` report | DDR4 is the known-good image variant in project build notes. The report does not expose it, so the summary does not claim a live DDR4 reading. |
| CPU/RAM/storage metrics | Existing `rocknix-info` script | It gathers CPU information, RAM available/capacity and `/storage/games-internal`/`games-external` usage. The formatter reads these report fields only. |
| Wi-Fi link state | Not present in the `rocknix-info` summary | The separate Network Information application uses `nmcli`; it remains accessible from the launcher. The System Information summary shows the report IP only. |
| Workspace and battery status bar | No existing System page status bar | Battery percent appears in the report; workspace is not a report field. |

Target verification command, executed through HX90 SSH to the RG34XX:

```sh
rocknix-info
df -h /storage
awk '/MemTotal|MemAvailable/ {print}' /proc/meminfo
nmcli -t -f DEVICE,TYPE,STATE device status
tr -d '\\0' </proc/device-tree/model
cat /etc/os-release
```

The report contained the values above; `df` independently reported `/storage` 229.3 GB, used 3.5 GB, 2%; `MemTotal` was 999676 kB and `MemAvailable` 788400 kB. The RG34XX was connected over Wi-Fi. The host `192.168.3.188` is NixOS with 64 GB RAM and a 1.8 TB `/storage`; those host values are not valid device data.


## Existing System Information redesign

### Old presentation issues

- The existing `system-info` app manifest is an existing Heya launcher entry. It executes `/usr/bin/heya-tool system-info`; `heya-tool` runs the existing `rocknix-info` report inside `less -R`.
- The old view is a flat 40-line report. Headings and measurements share the same plain text treatment, so identity, CPU, RAM, storage, network, and battery values have no visual priority on a handheld screen.
- This is a terminal report, not a GUI dashboard. The repository has no existing System page route, PocketJS tab model, or System-specific persistent state. The launcher menu remains the only app navigation.

### New presentation principles

- Keep `rocknix-info`, its data collection, the `system-info` app manifest, and its pager lifecycle unchanged. Reformat only the existing Heya report presentation.
- Add a compact ANSI vector-terminal header from fields already present in the report. Keep the full original report immediately below it, preserving fields and error output.
- Group device/OS/kernel, CPU, RAM, storage, network, and battery by hierarchy. Use ANSI 256-color cyan, green, amber and pale text, single-line separators, and no icons/cards/gradient.
- Fit the compact summary to a 78-column handheld terminal. Long platform values use separate OS and kernel lines.
- Values absent from `rocknix-info` remain absent. The report does not expose DDR type, display resolution, or PocketShell runtime version; do not invent them.
- Existing Heya launcher navigation and pager keys remain unchanged: SELECT returns, Y quits the pager, D-pad scrolls, L/R pages. Existing Monitor, SysInfo, Processes and Storage tool applications remain their original commands.

### ASCII layout

```text
┌─ SYSTEM ───────────────────────────────────────────────┐
│ DEVICE   <device model>                               │
│ OS <name/version>                                      │
│ KERNEL <release/architecture>                          │
├─ CPU ─────────────────────── RAM ──────────────────────┤
│ <CPU model> · <temperature> · <frequency>              │
│ RAM <available>/<capacity>   DISK <used>/<total>       │
│ NET <IP>   BAT <charge>                                 │
└─ FULL REPORT BELOW ────────────────────────────────────┘

SYSTEM INFORMATION:
DEVICE: Anbernic RG34XX
...
```

Values above illustrate the structure observed during the device run; live measurements vary. The full raw report remains the data authority.

### Existing Heya component and implementation map

```text
System Information app manifest
└── heya-tool system-info
    ├── rocknix-info (existing acquisition; unchanged)
    ├── compact ANSI summary (derived only from report lines)
    └── existing less -R pager
        ├── original full report
        └── existing controller keys
```

The edit is scoped to `projects/ROCKNIX/packages/apps/heya/scripts/heya-tool`, the existing dispatch/pager presentation. It adds no route, workspace, bridge, collector, service, app manifest, or persistence state.

## Runtime verification and screenshot limits

- The actual RG34XX was queried via HX90 SSH. `rocknix-info` reported device RG34XX, PJOS Linux 20261029, Linux 7.2.0 aarch64, H700 4-core CPU, current frequency 1008–1416 MHz during sampling, temperature 45–47°, RAM about 778 MB available / 999 MB capacity, storage 3.5G/229.3G (2%), IP 192.168.3.57, battery 100%. These values were read from the target at run time.
- Running the modified worktree `heya-tool` copied to the target's `/tmp` through `bash -n` and `system-info --inside` succeeded. It emitted the compact summary and all 40 lines of original report. This exercised the actual target commands/data and the existing pager; it did not install the modified package or change the device image.
- The target's installed Heya script and PocketJS boot image are older than this worktree. `/storage/dev/usr/bin/heya-tool` is an active development override, but no Heya launcher service is running; the current KMS app is the packaged PocketJS boot guest. The live framebuffer therefore captures that guest, not the Heya `less` page.
- A real Heya-page screenshot would require opening the existing PocketJS Terminal app and running `heya-tool system-info`, then capturing the LCD before returning to the boot guest. That app switch was not performed in this run. The source was exercised by copying the modified script to `/tmp` and invoking it over device SSH; it was not installed into the active override.

## Verification record

Executed on target through HX90:

- `bash -n /tmp/cpr96-heya-tool` — passed.
- `TERM=xterm-256color COLUMNS=78 LINES=28 LESS=-F bash /tmp/cpr96-heya-tool system-info --inside` — passed; the actual RG34XX report showed the compact summary and the full source report. The tool output recorded changing real CPU/RAM values; the address is omitted here for privacy.
- Manual visible-width check of the rendered report: longest summary line 69 columns in a 78-column terminal. Required device, OS/kernel, CPU, RAM, disk, network, battery, GPU and raw-report sections were present.

- Failure-path smoke on RG34XX: a temporary `rocknix-info` shim emitted a partial report and exited 1. The summary showed available fields, displayed `--` for absent values, and kept the partial raw report. The shim was isolated under `/tmp/cpr96-bin`; installed `/usr/bin/rocknix-info` was unchanged.

Not run / not evidenced: package build, image build, ANSI color capture from the pager stream, 720×480 app screenshot, 1280×720 preview, before/after screenshots, visual UI review, and device installation. The installed Heya script and live framebuffer are from an older image; the modified source was run from `/tmp`, not installed. No PocketJS/Rust files were changed by the final implementation.

## Delivery state

- Branch: `feature/system-workspace-redesign`.
- Base/HEAD at inspection: `30c39d01a4ae988149d09f7281f5c3f2e647666d` (no commit created).
- Changed files: `projects/ROCKNIX/packages/apps/heya/scripts/heya-tool` and `docs/system-workspace-redesign/README.md`. PocketJS guest and launcher bridge match HEAD after removing this session's out-of-scope edits.
- Issue #96 remains OPEN; no push, merge, or issue mutation performed.
- Incomplete goal criteria: GUI tabs/status bar and 2×2 graphical dashboard, actual PocketJS app screenshots, baseline/comparison screenshots, 1280×720 preview, package/image build, and installed-device visual review. The existing `system-info` app is a Heya terminal pager; delivering those UI criteria would require creating a new System page/route, contrary to the confirmed no-new-route scope.

### Acceptance criterion audit

| Criterion | Status | Evidence / gap |
| --- | --- | --- |
| Handheld PSP/VT100/Vector Pixel visual direction | Partial | Existing terminal report uses restrained vector-style separators and ANSI palette; no PocketJS graphical page exists. |
| Wi-Fi/IP/Workspace/Battery status bar | Not implemented | Heya report contains IP and battery; Wi-Fi state and active PocketJS workspace are not available in this report surface. |
| SYSTEM/RG34XX/H700 DDR4 identity | Partial | RG34XX/H700 are live report values. DDR4 is not exposed at runtime, so it is not fabricated. |
| CPU/RAM/Storage/Network graphical 2×2 grid | Not implemented | Text summary reprioritizes existing CPU/RAM/storage/IP fields; no graphical grid or structured network state. |
| Bottom OS/kernel/display/runtime details and five named tabs | Not implemented | OS/kernel appear in compact report; display/runtime fields and System page tabs do not exist in the owning Heya pager. Existing launcher tools remain accessible via their original catalog entries. |
| 16×16/24×24 icons and transitions/data fade | Not applicable to terminal pager | This surface uses text/ANSI and existing pager controls; no icon or page animation API. |
| Design docs / ASCII / component plan | Complete for actual Heya surface | This document covers old issues, principles, ASCII layout, and actual command/component flow. |
| 720×480 and 1280×720 screenshots / before-after comparison | Not complete | Modified Heya page was not installed/opened in the real KMS guest; no valid app screenshot or 1280×720 preview was captured. |
| Type/format/runtime checks | Partial | Bash syntax and target runtime text smoke passed. Heya package/image build and visual screenshot review not run. |
| Branch/HEAD/change scope/issue state | Complete | See Delivery state; no commit/push/merge/issue changes. |

