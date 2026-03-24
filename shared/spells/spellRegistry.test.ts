import { describe, it, expect } from "vitest";
import { SPELLS } from "./spellRegistry";
import { SpellId } from "../types";

describe("spellRegistry", () => {
  it("должен содержать все 16 заклинаний", () => {
    const expectedSpells: SpellId[] = [
      "fire_bolt",
      "burn_sigil",
      "flare_cleanse",
      "imp_swarm",
      "heal_ripple",
      "frost_shield",
      "tidal_erase",
      "mist_distortion",
      "stone_skin",
      "root_lock",
      "quake",
      "golem_tiles",
      "shock_dart",
      "chain_spark",
      "wind_sweep",
      "static_jinx",
    ];

    expectedSpells.forEach((spellId) => {
      expect(SPELLS[spellId]).toBeDefined();
      expect(SPELLS[spellId].id).toBe(spellId);
      expect(SPELLS[spellId].cooldownMs).toBeGreaterThan(0);
    });
  });

  it("каждое заклинание должно иметь корректный элемент", () => {
    const fireSpells: SpellId[] = ["fire_bolt", "burn_sigil", "flare_cleanse", "imp_swarm"];
    const waterSpells: SpellId[] = ["heal_ripple", "frost_shield", "tidal_erase", "mist_distortion"];
    const earthSpells: SpellId[] = ["stone_skin", "root_lock", "quake", "golem_tiles"];
    const airSpells: SpellId[] = ["shock_dart", "chain_spark", "wind_sweep", "static_jinx"];

    fireSpells.forEach((spellId) => {
      expect(SPELLS[spellId].element).toBe("fire");
    });

    waterSpells.forEach((spellId) => {
      expect(SPELLS[spellId].element).toBe("water");
    });

    earthSpells.forEach((spellId) => {
      expect(SPELLS[spellId].element).toBe("earth");
    });

    airSpells.forEach((spellId) => {
      expect(SPELLS[spellId].element).toBe("air");
    });
  });
});

