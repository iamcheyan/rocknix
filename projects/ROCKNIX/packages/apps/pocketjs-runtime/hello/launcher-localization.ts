export const LAUNCHER_LOCALES = [
  { id: "ja", names: ["アプリ", "ファイル", "Vim", "モニター", "ログ"], labels: { settings: "設定", language: "言語", selected: "選択中", open: "開く", back: "戻る", move: "移動", apps: "アプリケーション", settingLanguage: "表示言語" } },
  { id: "zh", names: ["应用", "文件", "Vim", "监控", "日志"], labels: { settings: "设置", language: "语言", selected: "已选择", open: "打开", back: "返回", move: "移动", apps: "应用程序", settingLanguage: "界面语言" } },
  { id: "en", names: ["Apps", "Files", "Vim", "Monitor", "Logs"], labels: { settings: "Settings", language: "Language", selected: "Selected", open: "Open", back: "Back", move: "Move", apps: "Applications", settingLanguage: "Display language" } },
] as const;

export type LauncherLocale = typeof LAUNCHER_LOCALES[number]["id"];
export const isLauncherLocale = (value: string): value is LauncherLocale => ["ja", "zh", "en"].includes(value);

export const launcherLocaleIndex = (locale: string): number => Math.max(0, LAUNCHER_LOCALES.findIndex((entry) => entry.id === locale));
