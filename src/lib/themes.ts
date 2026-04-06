export interface ThemeConfig {
  id: string;
  name: string;
  price: number;
  assets: {
    frame: string;
    input: string;
    button: string;
    buttonHover: string;
    banner: string;
    panelBg?: string;  // 미사용 (reserved)
  };
  colors: {
    bg: string;
    bgTranslucent: string;
    panelText: string;
    panelTextMuted: string;
    placeholder: string;
    accent: string;
    gold: string;
    headerBg: string;
    headerText: string;
    navBg: string;
    navText: string;
    navTextActive: string;
  };
}

export const THEMES: Record<string, ThemeConfig> = {
  paper: {
    id: "paper",
    name: "양피지",
    price: 0,
    assets: {
      frame: "/ui/paper/frame.png",
      input: "/ui/paper/input.png",
      button: "/ui/paper/button.png",
      buttonHover: "/ui/paper/button-hover.png",
      banner: "/ui/paper/banner.png",
    },
    colors: {
      bg: "#f5e6d0",
      bgTranslucent: "rgba(245, 230, 208, 0.5)",
      panelText: "#3a2010",
      panelTextMuted: "#6b4f30",
      placeholder: "#a08a6a",
      accent: "#b06820",
      gold: "#8b6500",
      headerBg: "#e8d5b8",
      headerText: "#3a2010",
      navBg: "#e8d5b8",
      navText: "#a08a6a",
      navTextActive: "#3a2010",
    },
  },
  flat: {
    id: "flat",
    name: "플랫",
    price: 2000,
    assets: {
      frame: "/ui/flat/frame.png",
      input: "/ui/flat/input.png",
      button: "/ui/flat/button.png",
      buttonHover: "/ui/flat/button-hover.png",
      banner: "/ui/flat/banner.png",
    },
    colors: {
      bg: "#e8edf2",
      bgTranslucent: "rgba(232, 237, 242, 0.5)",
      panelText: "#2c3e50",
      panelTextMuted: "#7f8c8d",
      placeholder: "#bdc3c7",
      accent: "#3498db",
      gold: "#f39c12",
      headerBg: "#d5dce4",
      headerText: "#2c3e50",
      navBg: "#d5dce4",
      navText: "#95a5a6",
      navTextActive: "#2c3e50",
    },
  },
  hologram: {
    id: "hologram",
    name: "홀로그램",
    price: 2000,
    assets: {
      frame: "/ui/hologram/frame.png",
      input: "/ui/hologram/input.png",
      button: "/ui/hologram/button.png",
      buttonHover: "/ui/hologram/button-hover.png",
      banner: "/ui/hologram/banner.png",
    },
    colors: {
      bg: "#0a1628",
      bgTranslucent: "rgba(10, 22, 40, 0.7)",
      panelText: "#c0e8ff",
      panelTextMuted: "#80b8d8",
      placeholder: "#5a9aba",
      accent: "#00d4ff",
      gold: "#ffd700",
      headerBg: "#0d2040",
      headerText: "#00d4ff",
      navBg: "#0d2040",
      navText: "#3a6a8a",
      navTextActive: "#00d4ff",
    },
  },
  stone: {
    id: "stone",
    name: "스톤",
    price: 2000,
    assets: {
      frame: "/ui/stone/frame.png",
      input: "/ui/stone/input.png",
      button: "/ui/stone/button.png",
      buttonHover: "/ui/stone/button-hover.png",
      banner: "/ui/stone/banner.png",
    },
    colors: {
      bg: "#d8d0c8",
      bgTranslucent: "rgba(216, 208, 200, 0.5)",
      panelText: "#2a2520",
      panelTextMuted: "#6a6058",
      placeholder: "#9a9088",
      accent: "#5a7090",
      gold: "#b8860b",
      headerBg: "#b8b0a8",
      headerText: "#2a2520",
      navBg: "#b8b0a8",
      navText: "#8a8078",
      navTextActive: "#2a2520",
    },
  },
  glass: {
    id: "glass",
    name: "글래스",
    price: 2000,
    assets: {
      frame: "/ui/glass/frame.png",
      input: "/ui/glass/input.png",
      button: "/ui/glass/button.png",
      buttonHover: "/ui/glass/button-hover.png",
      banner: "/ui/glass/banner.png",
    },
    colors: {
      bg: "#e8f4f8",
      bgTranslucent: "rgba(232, 244, 248, 0.5)",
      panelText: "#1a3a4a",
      panelTextMuted: "#5a8a9a",
      placeholder: "#8abaca",
      accent: "#2aa0c0",
      gold: "#d4a017",
      headerBg: "#c8e8f0",
      headerText: "#1a3a4a",
      navBg: "#c8e8f0",
      navText: "#7aaaba",
      navTextActive: "#1a3a4a",
    },
  },
  runewood: {
    id: "runewood",
    name: "룬우드",
    price: 2000,
    assets: {
      frame: "/ui/runewood/frame.png",
      input: "/ui/runewood/input.png",
      button: "/ui/runewood/button.png",
      buttonHover: "/ui/runewood/button-hover.png",
      banner: "/ui/runewood/banner.png",
    },
    colors: {
      bg: "#2a1a10",
      bgTranslucent: "rgba(42, 26, 16, 0.7)",
      panelText: "#e8d0a8",
      panelTextMuted: "#a08060",
      placeholder: "#9a7a60",
      accent: "#d4880a",
      gold: "#ffc040",
      headerBg: "#3a2818",
      headerText: "#e8c888",
      navBg: "#3a2818",
      navText: "#9a7a60",
      navTextActive: "#e8c888",
    },
  },
};

export const DEFAULT_THEME = "paper";
