# OTA simulator execution record

Run from `tools/pocketshell-dev` on a host with Cargo dependencies available. All paths are temporary directories; no block device or production service is used.

## Build and CLI

`cargo check` completed successfully. Compiler warnings remain for intentionally unused unsupported-provider API types and the HTTP provider, plus the library rollback method when only the CLI target is compiled.

`POCKETSHELL_OTA_ROOT=<temporary-directory> POCKETSHELL_OTA_PUBLIC_KEY=$PWD/fixtures/ota/public-key.hex cargo run -- push 192.0.2.1 --dry-run` completed successfully and printed:

```text
{"flow":["build: skipped (host fixture)","classify: Workspace","package: verified 10240 bytes SHA-256 ac0a2d5cee8071c1af61cba39e7bf672a037bcf86bf5b81df381349fc5e378dd","upload: localhost filesystem provider","stage: slot-b","handoff: simulated pending; no reboot executed","health: awaiting explicit confirmation or boot failure"],"state":{"active":"slot-a","pending":"slot-b","pending_version":2,"boot_failures":0,"confirmed_version":1,"status":"pending"}}
```

State after staging: `active=slot-a`, `pending=slot-b`, `confirmed_version=1`, `status=pending`. The recovery fixture SHA-256 before/after staging was `de2936a36df1a151f9e5ba367ccb53e02b25dee8df93841b8cc6ff1e3172a431`.

## HTTP API

Started `cargo run -- 18087` with `POCKETSHELL_OTA_ROOT=/tmp/pocketshell-ota-api-verify`, `POCKETSHELL_OTA_PUBLIC_KEY` pointing at the checked-in public key, and `POCKETSHELL_OTA_FIXTURE` pointing at the fixture directory. Requests to `/api/ota/check`, `/api/ota/install`, `/api/ota/confirm`, `/api/ota/status`, and `/api/ota/log` succeeded. Check reported workspace level, version 2, changelog, and HTTP/discovery/GitHub/USB as unsupported. Install staged `slot-b`; confirmation changed active to `slot-b`, version to 2, and cleared pending state. Audit log contained `stage` and `confirm` events. Recovery hash remained the same.

In a separate run, three `POST /api/ota/boot-failure` calls left active `slot-a`, cleared pending state, and set `status=rolled_back`. The HTTP server was stopped after the run.

## Limits

The browser page was not exercised in a real browser. The API was exercised directly over localhost. The CLI simulates packaging and upload; it does not run a firmware build or contact the supplied IP. No device, partition, raw block device, reboot, or production service was used.
