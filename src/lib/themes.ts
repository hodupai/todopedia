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
};

export const DEFAULT_THEME = "paper";
