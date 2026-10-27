// SPDX-License-Identifier: GPL-2.0-or-later
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

const devRoot = "/storage/dev"

func main() {
	if len(os.Args) < 2 {
		fatal("usage: devexec /absolute/program [arguments...]")
	}

	target := os.Args[1]
	if !filepath.IsAbs(target) || filepath.Clean(target) != target || target == "/" || strings.HasPrefix(target, devRoot+"/") {
		fatal("target must be a clean absolute system path outside /storage/dev")
	}

	candidate := filepath.Join(devRoot, strings.TrimPrefix(target, "/"))
	selected := target
	if _, err := os.Stat(candidate); err == nil {
		resolved, resolveErr := filepath.EvalSymlinks(candidate)
		if resolveErr != nil && !os.IsNotExist(resolveErr) {
			fatal("cannot resolve override: " + resolveErr.Error())
		}
		if resolveErr == nil {
			resolved, resolveErr = filepath.Abs(resolved)
			if resolveErr != nil || (resolved != devRoot && !strings.HasPrefix(resolved, devRoot+string(os.PathSeparator))) {
				fatal("override resolves outside /storage/dev")
			}
			info, statErr := os.Stat(candidate)
			if statErr != nil {
				fatal("cannot inspect override: " + statErr.Error())
			}
			if !info.Mode().IsRegular() {
				fatal("override must be a regular file")
			}
			selected = candidate
		}
	} else if !os.IsNotExist(err) {
		fatal("cannot inspect override: " + err.Error())
	}

	if err := syscall.Exec(selected, append([]string{selected}, os.Args[2:]...), os.Environ()); err != nil {
		fatal("exec " + selected + ": " + err.Error())
	}
}

func fatal(message string) {
	fmt.Fprintln(os.Stderr, "devexec:", message)
	os.Exit(127)
}
