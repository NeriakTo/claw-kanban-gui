import os from "node:os";
import fs from "node:fs";
import path from "node:path";

export interface PluginConfig {
  apiKey?: string;
  cloudApiEndpoint?: string;
  resendApiKey?: string;
}

export function getMergedConfig(apiConfig: PluginConfig): PluginConfig {
  let fallbackConfig: PluginConfig = {};
  
  try {
    // Try global config in user home directory
    const globalConfigPath = path.join(os.homedir(), ".claw-kanban", "config.json");
    if (fs.existsSync(globalConfigPath)) {
      fallbackConfig = JSON.parse(fs.readFileSync(globalConfigPath, "utf-8"));
    }
  } catch (e) {
    console.warn("[claw-kanban] Failed to read global config:", e);
  }

  try {
    // Try local config in current working directory (useful for per-project overrides)
    const localConfigPath = path.join(process.cwd(), ".claw-kanban", "config.json");
    if (fs.existsSync(localConfigPath)) {
      const localConfig = JSON.parse(fs.readFileSync(localConfigPath, "utf-8"));
      fallbackConfig = { ...fallbackConfig, ...localConfig };
    }
  } catch (e) {
    console.warn("[claw-kanban] Failed to read local config:", e);
  }

  // Merge: apiConfig > localConfig > globalConfig
  return {
    apiKey: apiConfig.apiKey?.trim() || fallbackConfig.apiKey?.trim(),
    cloudApiEndpoint: apiConfig.cloudApiEndpoint?.trim() || fallbackConfig.cloudApiEndpoint?.trim(),
    resendApiKey: apiConfig.resendApiKey?.trim() || fallbackConfig.resendApiKey?.trim(),
  };
}

export function saveGlobalConfig(newConfig: Partial<PluginConfig>) {
  try {
    const dir = path.join(os.homedir(), ".claw-kanban");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const configPath = path.join(dir, "config.json");
    
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    
    const merged = { ...existingConfig, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf-8");
  } catch (e) {
    console.error("[claw-kanban] Failed to save global config:", e);
  }
}
