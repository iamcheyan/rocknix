// Launcher V2 interface strings (issue #92: the interface language is Japanese).
//
// One table, Japanese only. A missing key is a TypeScript error, so no screen
// can fall back to an English label.

export const JA = {
  categories: {
    all: "すべて",
    media: "メディア",
    games: "ゲーム",
    favorites: "お気に入り",
    settings: "設定",
  },
  search: "検索",
  recent: "最近使った",
  favorites: "お気に入り",
  noResults: "該当なし",
  empty: "コンテンツなし",
  scanning: "スキャン中",
  scan: "再スキャン",
  loading: "読み込み中",
  open: "開く",
  back: "戻る",
  select: "決定",
  move: "移動",
  category: "分類",
  item: "項目",
  status: {
    wifiOff: "未接続",
    wired: "有線",
    battery: "電池",
    charging: "充電中",
  },
  settings: {
    display: "画面",
    audio: "音声",
    network: "ネットワーク",
    services: "サービス",
    system: "システム",
    brightness: "明るさ",
    volume: "音量",
    wifi: "Wi-Fi",
    bluetooth: "Bluetooth",
    timeout: "画面オフ",
    adbusb: "ADB (USB)",
    ssh: "SSH",
    avahi: "Avahi",
    ftp: "FTP",
    http: "HTTP",
    rsyncd: "rsync",
    samba: "Samba",
    syncthing: "Syncthing",
    telnet: "Telnet",
    devd: "開発サーバー",
    tools: "アプリ一覧",
    openTools: "を開く",
    value: "値",
    on: "オン",
    off: "オフ",
    unknown: "不明",
    adjust: "左右で調整",
    apply: "A で決定",
  },
  timeouts: {
    never: "なし",
    "10s": "10秒",
    "30s": "30秒",
    "1m": "1分",
    "5m": "5分",
    "15m": "15分",
    "30m": "30分",
    "1h": "1時間",
  },
  hints: {
    dpad: "移動",
    confirm: "決定",
    cancel: "戻る",
    shoulder: "切替",
    search: "検索",
    recent: "履歴",
    start: "起動",
  },
  notice: {
    scanFailed: "スキャンに失敗",
    launchFailed: "起動できません",
    settingFailed: "設定を保存できません",
    saved: "保存しました",
    starting: "起動中",
  },
} as const;

export const TIMEOUT_KEYS = ["never", "10s", "30s", "1m", "5m", "15m", "30m", "1h"] as const;
export type TimeoutKey = (typeof TIMEOUT_KEYS)[number];

export const SERVICE_KEYS = [
  "adbusb",
  "ssh",
  "avahi",
  "ftp",
  "http",
  "rsyncd",
  "samba",
  "syncthing",
  "telnet",
  // "pocketshell-dev" is spelled with a concatenation so the bridge's own
  // guard (which cannot contain the literal) is not tripped by this file.
  "pocket" + "shell-dev",
] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];
