import type { SurvivalWeaponDefinition, SurvivalWavesConfig } from "../types";
import weaponsData from "./weapons.json";
import wavesData from "./waves.json";

export const survivalWeapons = weaponsData as SurvivalWeaponDefinition[];
export const survivalWaves = wavesData as SurvivalWavesConfig;
