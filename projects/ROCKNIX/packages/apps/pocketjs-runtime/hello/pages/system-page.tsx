import { createEffect, Index } from "solid-js";
import {
  Text,
  View,
  type NodeMirror,
} from "@pocketjs/framework/solid/components";
import { animate } from "@pocketjs/framework/animation";
import type { LauncherApp } from "../launcher-catalog";
import { PixelIcon } from "../pixel-icon";
import { ramUsage, type SystemSnapshot } from "../system-status";

export interface SystemPageProps {
  selectedToolIndex: number;
  systemTools: LauncherApp[];
  ipAddress: string;
  wifiConnected: boolean;
  snapshot: SystemSnapshot | null;
}

const INK = "#06111B";
const CYAN = "#3ECFFF";
const GREEN = "#00FF99";
const AMBER = "#FFB400";
const PALE = "#D8E8FF";
const MUTED = "#7893A8";
const LINE = "#1B3345";

const text = (value: string | null | undefined) => value || "--";
const blocks = (percent: number | null, width = 8) => {
  const filled = percent === null ? 0 : Math.round((Math.max(0, Math.min(100, percent)) / 100) * width);
  return Array.from({ length: width }, (_, index) => index < filled);
};

const compactOs = (snapshot: SystemSnapshot | null) =>
  text(snapshot?.os).replace(/\s*Linux\s*/i, " ").trim();
const compactKernel = (snapshot: SystemSnapshot | null) =>
  text(snapshot?.kernel).replace(/^Linux\s+/i, "").replace(/\s*\(([^)]+)\)\s*$/, " $1");

function Metric(props: {
  kind: "cpu" | "ram" | "storage" | "network";
  color: string;
  label: string;
  value: string;
  meta: string;
  percent?: number | null;
}) {
  return (
    <View class="flex-1 flex-row items-center px-1">
      <PixelIcon kind={props.kind} color={props.color} />
      <View class="flex-col flex-1 ml-1">
        <View class="flex-row items-center justify-between">
          <Text class="text-xs font-bold" style={{ textColor: props.color }}>{props.label}</Text>
          <Text class="text-xs" style={{ textColor: MUTED }}>{props.meta}</Text>
        </View>
        <Text class="text-sm font-bold font-mono" style={{ textColor: PALE }}>{props.value}</Text>
        {props.percent !== undefined ? (
          <View class="flex-row gap-[1px] h-[3px] w-[48px] mt-[1px]">
            <Index each={blocks(props.percent ?? null)}>
              {(filled) => (
                <View
                  class="flex-1 h-[3px]"
                  style={{ bgColor: filled() ? props.color : LINE }}
                />
              )}
            </Index>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ToolTab(props: {
  tool: LauncherApp;
  active: boolean;
}) {
  return (
    <View class="flex-1 h-[18px] flex-col">
      <Text
        class={props.active ? "text-xs font-bold" : "text-xs"}
        style={{ textColor: props.active ? GREEN : MUTED }}
      >
        {props.active ? "▸" : " "}{props.tool.shortName || props.tool.name}
      </Text>
      <View class="h-[1px]" style={{ bgColor: props.active ? GREEN : INK }} />
    </View>
  );
}

export function SystemPage(props: SystemPageProps) {
  const snapshot = () => props.snapshot;
  const ram = () => ramUsage(props.snapshot);
  const usedMb = () => ram()?.usedMb ?? null;
  const totalMb = () => ram()?.totalMb ?? null;
  const cpuValue = () => [snapshot()?.frequency, snapshot()?.temperature].filter(Boolean).join("  ") || "--";
  let dataNode: NodeMirror | undefined;

  createEffect(() => {
    props.snapshot;
    if (!dataNode) return;
    try {
      animate(dataNode, "opacity", 0.55, { dur: 0 });
      animate(dataNode, "opacity", 1, { dur: 150, easing: "out" });
    } catch {
      // The frame still contains current data when animation is unavailable.
    }
  });
  let tabsNode: NodeMirror | undefined;

  createEffect(() => {
    props.selectedToolIndex;
    if (!tabsNode) return;
    try {
      animate(tabsNode, "opacity", 0.55, { dur: 0 });
      animate(tabsNode, "opacity", 1, { dur: 150, easing: "out" });
    } catch {
      // Selection remains visible without animation.
    }
  });

  return (
    <View class="w-[360px] h-[198px] flex-col" style={{ bgColor: INK }}>
      <View class="h-[36px] flex-col px-2">
        <View class="flex-row items-center justify-between">
          <Text class="text-base font-bold tracking-wide" style={{ textColor: CYAN }}>
            SYSTEM
          </Text>
          <Text class="text-xs font-mono" style={{ textColor: AMBER }}>
            {text(snapshot()?.ramVariant)}
          </Text>
        </View>
        <Text class="text-xs font-mono" style={{ textColor: PALE }}>
          {text(snapshot()?.model)} · {text(snapshot()?.hardware)}
        </Text>
      </View>
      <View class="h-[1px] mx-2" style={{ bgColor: LINE }} />

      <View class="h-[78px] flex-col" ref={(node: NodeMirror) => { dataNode = node; }}>
        <View class="h-[38px] flex-row">
          <Metric
            kind="cpu"
            color={CYAN}
            label="CPU"
            value={cpuValue()}
            meta={snapshot()?.cpu ?? "--"}
          />
          <View class="w-[1px] h-[29px]" style={{ bgColor: LINE }} />
          <Metric
            kind="ram"
            color={GREEN}
            label="RAM"
            value={usedMb() === null ? "--" : `${usedMb()} / ${totalMb()} MB`}
            meta={ram() === null ? "AVAILABLE --" : `USED ${ram()!.percent}%`}
            percent={ram()?.percent ?? null}
          />
        </View>
        <View class="h-[1px] mx-1" style={{ bgColor: LINE }} />
        <View class="h-[38px] flex-row">
          <Metric
            kind="storage"
            color={AMBER}
            label="STORAGE"
            value={snapshot()?.storageUsed && snapshot()?.storageTotal
              ? `${snapshot()!.storageUsed} / ${snapshot()!.storageTotal}`
              : "--"}
            meta={snapshot()?.storagePercent === null || snapshot()?.storagePercent === undefined
              ? "/STORAGE --"
              : `/STORAGE ${snapshot()!.storagePercent}%`}
            percent={snapshot()?.storagePercent ?? null}
          />
          <View class="w-[1px] h-[29px]" style={{ bgColor: LINE }} />
          <Metric
            kind="network"
            color={CYAN}
            label="NETWORK"
            value={text(props.ipAddress)}
            meta={props.wifiConnected ? "WIFI ON" : "WIFI OFF"}
          />
        </View>
      </View>
      <View class="h-[1px] mx-2" style={{ bgColor: LINE }} />

      <View class="flex-1 flex-col justify-between px-2">
        <View class="flex-col" ref={(node: NodeMirror) => { tabsNode = node; }}>
          <View class="h-[14px] flex-row items-center justify-between">
            <Text class="text-xs font-bold tracking-wide" style={{ textColor: GREEN }}>TOOLS</Text>
            <Text class="text-xs" style={{ textColor: MUTED }}>◀▶ SELECT · A RUN</Text>
          </View>
          <View class="h-[18px] flex-row">
            <Index each={props.systemTools.slice(0, 5)}>
              {(tool, index) => (
                <ToolTab tool={tool()} active={props.selectedToolIndex === index} />
              )}
            </Index>
          </View>
          <View class="h-[18px] flex-row">
            <Index each={props.systemTools.slice(5, 9)}>
              {(tool, index) => (
                <ToolTab tool={tool()} active={props.selectedToolIndex === index + 5} />
              )}
            </Index>
            <View class="flex-1" />
          </View>
        </View>

        <View class="flex-col">
          <Text class="text-xs font-mono" style={{ textColor: MUTED }}>
            OS {compactOs(snapshot())} · KERNEL {compactKernel(snapshot())}
          </Text>
          <Text class="text-xs font-mono" style={{ textColor: AMBER }}>
            DISPLAY {text(snapshot()?.display)} · POCKETSHELL {text(snapshot()?.runtime)}
          </Text>
        </View>
      </View>
    </View>
  );
}
