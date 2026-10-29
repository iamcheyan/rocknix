import { Index } from "solid-js";
import { animate } from "@pocketjs/framework/animation";
import { Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { LAUNCHER_LOCALES, launcherLocaleIndex, type LauncherLocale } from "./launcher-localization";

const WORKSPACES = [
  { icon: "\uf11b", type: ["システム", "系统", "SYSTEM"], description: ["アプリとシステムツール", "应用程序与系统工具", "Applications and system tools"] },
  { icon: "\uf07b", type: ["ファイル", "文件", "FILES"], description: ["ファイルとドキュメント", "文件与文档", "Files and documents"] },
  { icon: "\uf044", type: ["エディター", "编辑器", "EDITOR"], description: ["Vim テキストエディター", "Vim 文本编辑器", "Vim text editor"] },
  { icon: "\uf201", type: ["モニター", "监控", "MONITOR"], description: ["システムリソースを監視", "监视系统资源", "Monitor system resources"] },
  { icon: "\uf15c", type: ["診断", "诊断", "DIAGNOSTICS"], description: ["システムログと診断", "系统日志与诊断", "System logs and diagnostics"] },
] as const;

type Props = {
  locale: LauncherLocale;
  workspace: number;
  overview: boolean;
  page: "apps" | "settings";
  selection: number;
  rows: readonly string[];
  notice: string;
  onNavigate: (direction: number) => void;
  onEnterList: () => void;
  onOpen: () => void;
  onBack: () => void;
  onLanguage: () => void;
};

export function LauncherHome(props: Props) {
  const localeIndex = () => launcherLocaleIndex(props.locale);
  let selectedIcon: NodeMirror | undefined;
  let detailNode: NodeMirror | undefined;
  const animateFocus = () => {
    if (selectedIcon) animate(selectedIcon, "scale", 1.16, { dur: 130, easing: "out" });
    if (detailNode) {
      animate(detailNode, "opacity", 0.35, { dur: 80, easing: "out" });
      animate(detailNode, "opacity", 1, { dur: 130, easing: "out" });
    }
  };
  const navigate = (direction: number) => { props.onNavigate(direction); animateFocus(); };
  const enterList = () => { props.onEnterList(); animateFocus(); };
  const back = () => { props.onBack(); animateFocus(); };
  const open = () => { if (props.page === "settings" && props.selection === 0) props.onLanguage(); else props.onOpen(); };
  return (
    <>
      {props.overview ? (
        <View class="absolute left-[18px] top-[34px] w-[324px] h-[145px] flex-col items-start justify-center" ref={(node: NodeMirror) => { detailNode = node; }} onPress={enterList}>
          <Text class="text-4xl text-emerald-300">{WORKSPACES[props.workspace].icon}</Text>
          <Text class="text-2xl font-bold text-white">{LAUNCHER_LOCALES[localeIndex()].names[props.workspace]}</Text>
          <Text class="text-xs text-slate-300">{WORKSPACES[props.workspace].description[localeIndex()]}</Text>
          <Text class="text-xs font-mono text-emerald-300">{WORKSPACES[props.workspace].type[localeIndex()]} / {LAUNCHER_LOCALES[localeIndex()].labels.selected}</Text>
        </View>
      ) : (
        <View class="absolute left-[18px] top-[30px] w-[324px] h-[150px] flex-col">
          <Text class="text-xs font-mono text-emerald-300">{props.page === "settings" ? LAUNCHER_LOCALES[localeIndex()].labels.settings : LAUNCHER_LOCALES[localeIndex()].labels.apps} · {props.selection + 1}/{props.rows.length}</Text>
          <Index each={props.rows.slice(Math.floor(props.selection / 6) * 6, Math.floor(props.selection / 6) * 6 + 6)}>{(name, offset) => {
            const index = () => Math.floor(props.selection / 6) * 6 + offset;
            const selected = () => index() === props.selection;
            const language = () => props.page === "settings" && index() === 0;
            return <View class={selected() ? "w-[324px] h-[20px] bg-slate-800" : "w-[324px] h-[20px]"} onPress={() => { if (selected()) open(); }}><Text class="text-xs font-mono text-white">{selected() ? "▸ " : "  "}{name()}{language() ? `: ${LAUNCHER_LOCALES[localeIndex()].names[localeIndex()]}` : ""}</Text></View>;
          }}</Index>
          <Text class="text-xs text-emerald-300">{props.notice}</Text>
        </View>
      )}
      <View class="absolute left-[24px] top-[183px] w-[312px] h-[26px] flex-row items-center justify-center">
        <Index each={WORKSPACES}>{(workspace, index) => <View class="w-[56px] h-[26px] items-center justify-center" ref={index === props.workspace ? (node: NodeMirror) => { selectedIcon = node; } : undefined}><Text class={props.workspace === index ? "text-2xl text-emerald-300" : "text-xl text-slate-600"}>{workspace().icon}</Text></View>}</Index>
      </View>
      <View class="absolute left-[10px] top-[222px] w-[340px] h-[16px] items-center">
        <Text class="text-xs text-slate-500">L/R {LAUNCHER_LOCALES[localeIndex()].labels.move}  A {LAUNCHER_LOCALES[localeIndex()].labels.open}  B {LAUNCHER_LOCALES[localeIndex()].labels.back}</Text>
      </View>
    </>
  );
}
