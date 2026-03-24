export type ElementId = "fire" | "water" | "earth" | "air";

export interface Element {
  symbol: string;
  color: string;
  key: string;
}

export const ELEMENTS: Record<ElementId, Element> = {
  fire: {
    symbol: "#",
    color: "#ff4444", // красный
    key: "1",
  },
  water: {
    symbol: "~",
    color: "#44aaff", // синий/циан
    key: "2",
  },
  earth: {
    symbol: "+",
    color: "#44ff44", // зелёный
    key: "3",
  },
  air: {
    symbol: "*",
    color: "#aa44ff", // фиолетовый
    key: "4",
  },
};

export const ELEMENT_BY_KEY: Record<string, ElementId> = {
  "1": "fire",
  "2": "water",
  "3": "earth",
  "4": "air",
};

