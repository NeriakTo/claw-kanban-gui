# Troubleshooting & Lessons Learned for `claw-kanban`

This document summarizes the key issues encountered and solved during the initial development and debugging of the `claw-kanban` OpenClaw plugin.

---

### 1. The Core Problem: Silent `activate` Failure & Tool Not Registering

The most persistent and misleading issue was that the plugin's web server would start (proving the `activate` function was called), but the agent tools (`kanban_update`, `kanban_query`) were never registered. Calling them resulted in `tool.execute is not a function` or `Tool not found`.

**Root Cause**: The way we exported the plugin and registered the tools did not match the specific patterns required by the OpenClaw plugin loader. The official documentation shows two main ways to export a plugin, and for registering agent tools, one specific pattern must be followed precisely.

**Final Solution**:

The plugin's main entry file (`src/index.ts`) **must** be structured as a **default export of a function** that receives the `api` object. Inside this function, each tool is registered with `api.registerTool` using an object that contains `name`, `description`, `parameters`, and an `execute` function.

**Correct `src/index.ts` Structure:**

```typescript
import { handleKanbanUpdate, handleKanbanQuery } from "./tools/handlers.js";
// ... other imports

// Export a default function as the plugin entry point
export default async function (api: any) {
  // ... setup logic (start web server, etc.) ...

  // Register tools one by one using the correct object structure
  api.registerTool({
    name: "kanban_update",
    description: "Create or update a task on the Kanban board",
    // Parameters can be loaded from the manifest to avoid duplication
    parameters: (await import("../openclaw.plugin.json", { assert: { type: "json" } })).default.tools.kanban_update.parameters,
    // The handler function MUST be named `execute`
    async execute(_id: string, params: any) {
      const result = await handleKanbanUpdate(store, params);
      // The return value MUST be wrapped in a `{ content: [...] }` object
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  });

  api.registerTool({
    name: "kanban_query",
    // ... similar structure
  });
}
```

---

### 2. Plugin Manifest (`openclaw.plugin.json`) Requirements

- **Symptom**: Gateway failed to start with errors like `plugin manifest requires id` or `plugin manifest requires configSchema`.
- **Root Cause**: The `openclaw.plugin.json` was missing mandatory fields.
- **Solution**: The manifest must contain at least `id` and `configSchema` (even if empty).

**Minimal `openclaw.plugin.json`:**
```json
{
  "$schema": "...",
  "id": "claw-kanban",
  "name": "claw-kanban",
  "version": "0.1.0",
  "configSchema": {},
  "skills": ["..."],
  "tools": { "...": { "description": "...", "parameters": {} } }
}
```

---

### 3. Build & Packaging (`package.json` & `tsup.config.ts`)

- **Symptom**: `activate` function not found, or module format conflicts.
- **Root Cause**: Incorrect build configuration led to the `activate` function being removed by tree-shaking, or a mismatch between the declared module type and the build output format.
- **Solution**:
    - **`package.json`**:
        - `"type": "module"` to declare it as an ES Module project.
        - `"main": "dist/index.js"` pointing to the single entry point.
        - The `openclaw.extensions` field is **not needed** if you are relying on the auto-discovery mechanism. It's more for complex "package packs". For a single plugin, placing it in the extensions directory is sufficient.
    - **`tsup.config.ts`**:
        - Have a **single entry point**: `entry: ['src/index.ts']`.
        - The format should match `package.json`: `format: ['esm']`.

---

### 4. Deployment & Discovery

- **Symptom**: Various errors during `openclaw plugins install` or manual configuration.
- **Root Cause**: Trying to fight the system instead of using the simplest discovery method.
- **Solution**:
    1.  **Do not** manually edit `~/.openclaw/openclaw.json`.
    2.  Simply place the entire compiled plugin directory (containing `package.json`, `dist/`, `openclaw.plugin.json`, `skills/`, etc.) into `~/.openclaw/extensions/`.
    3.  The directory name should match the plugin ID (e.g., `~/.openclaw/extensions/claw-kanban`).
    4.  OpenClaw will auto-discover and load the plugin on the next restart. This is the most reliable method for local development.

---
### 5. Environment Issues ("Zombie" Processes)

- **Symptom**: Gateway or plugin web server failed to start with `EADDRINUSE: address already in use`.
- **Root Cause**: Previous failed restarts left "zombie" `node` processes occupying the required ports.
- **Solution**: Manually find and kill the process occupying the port.
  ```bash
  # Find the process ID (PID)
  lsof -i :<port_number>

  # Force kill the process
  kill -9 <PID>
  ```
This needs to be done before a clean restart.


---

# Appendix: Detailed Debugging History (Raw Diary)


# Debugging Diary: Getting `claw-kanban` to Load

This document summarizes the long and winding road to getting the `claw-kanban` OpenClaw plugin to load correctly. We encountered multiple, cascading issues. This diary is to prevent future developers (and agents) from repeating these mistakes.

---

## Issue 1: Incorrect Install Command

- **Symptom**: `openclaw extension install ...` failed with `unknown command 'extension'`.
- **Root Cause**: The command for managing plugins was `openclaw plugins`, not `openclaw extension`.
- **Solution**: Use the correct command: `openclaw plugins install`.

---

## Issue 2: `package.json` Missing `openclaw.extensions`

- **Symptom**: `openclaw plugins install ...` failed with `Error: package.json missing openclaw.extensions`.
- **Root Cause**: The plugin's `package.json` file, which acts as a manifest for `npm`, didn't contain the `openclaw.extensions` field. This field is required by OpenClaw to identify which files within the package are actual plugin entry points.
- **Solution**: Add the `openclaw` block to `package.json`:
  ```json
  "openclaw": {
    "extensions": [
      "./dist/index.js"
    ]
  }
  ```

---

## Issue 3: `openclaw.plugin.json` Missing `id`

- **Symptom**: `openclaw plugins install ...` failed with `Config validation failed: plugin manifest requires id`.
- **Root Cause**: The plugin manifest file (`openclaw.plugin.json`) was missing the mandatory `id` field. This ID is used internally by OpenClaw to manage the plugin.
- **Solution**: Add a unique `id` to `openclaw.plugin.json`. This should ideally match the directory name and other references.
  ```json
  {
    "id": "claw-kanban",
    "name": "claw-kanban",
    ...
  }
  ```

---

## Issue 4: `openclaw.plugin.json` Missing `configSchema`

- **Symptom**: OpenClaw gateway failed to restart, with logs showing `plugin manifest requires configSchema`.
- **Root Cause**: The plugin manifest requires a `configSchema` object, even if the plugin has no configuration.
- **Solution**: Add an empty `configSchema` to `openclaw.plugin.json`.
  ```json
  {
    "id": "claw-kanban",
    ...
    "configSchema": {},
    ...
  }
  ```

---

## Issue 5: `id` Mismatch (The Real Culprit)

- **Symptom**: Plugin was discovered and listed by `openclaw plugins list` but showed an `error` status. Logs showed `plugin id mismatch` or `plugin not found: claw-kanban` / `plugin not found: kanban`.
- **Root Cause**: OpenClaw looks up plugins by the ID in `plugins.entries.<id>`. The plugin ID must be consistent everywhere. We use `claw-kanban` (matching project name and CLI binary) to avoid user confusion.
- **Solution**: Ensure the plugin ID is consistent **everywhere**:
    1.  `openclaw.plugin.json` → `"id": "claw-kanban"`
    2.  The exported object in `src/plugin.ts` → `id: "claw-kanban"`
    3.  The directory name `~/.openclaw/extensions/claw-kanban` (recommended)
    4.  `~/.openclaw/openclaw.json` → `plugins.entries["claw-kanban"]` (not `kanban`)

---

## Issue 6: Incorrect Plugin Export Method

- **Symptom**: Even after fixing IDs, logs showed `kanban missing register/activate export`. The `activate` function was still not being found.
- **Root Cause**: The way we were exporting the plugin from our entry file did not match the two valid patterns specified in the OpenClaw documentation. We tried `export { plugin as activate }` and `export const activate = plugin.register`, but the docs require either a default export of the full plugin object or a default export of just the register function.
- **Solution**: The entry file (`src/index.ts`) must export the entire plugin object as the **default export**.
  ```typescript
  const plugin = {
    id: "claw-kanban",
    name: "Claw Kanban",
    // ...
    async register(api: any) { /*...*/ }
  };

  export default plugin;
  ```

---

## Issue 7: Build Configuration (Tree-Shaking & Module Format)

- **Symptom**: The `activate` (or `default`) export was not present in the final `dist/index.js` file, or module loading failed silently.
- **Root Cause**:
    1.  **Tree-Shaking**: `tsup.config.ts` had multiple entries. When the main entry (`src/index.ts`) didn't directly use the `activate` function from another file (`src/plugin.ts`), the bundler (tsup) removed it as "dead code".
    2.  **Module Format**: `package.json` had `"type": "module"` (ESM) but `tsup.config.ts` was, at one point, configured to output `cjs` (CommonJS), causing a format conflict.
- **Solution**:
    1.  Consolidate all plugin logic and the main export into a single entry file (`src/index.ts`).
    2.  Ensure `tsup.config.ts` has only that single entry.
    3.  Ensure the `format` in `tsup.config.ts` matches the `"type"` in `package.json` (e.g., `esm` for `"type": "module"`).

---

## Final Working Configuration Checklist

-   **`~/Downloads/projects/claw-kanban/package.json`**:
    -   `"type": "module"`
    -   `"main": "dist/index.js"`
    -   `"openclaw": { "extensions": ["dist/index.js"] }` (Points to the compiled entry file)
-   **`~/Downloads/projects/claw-kanban/openclaw.plugin.json`**:
    -   Contains `"id": "claw-kanban"`
    -   Contains `"configSchema": {}`
-   **`~/Downloads/projects/claw-kanban/src/plugin.ts`**:
    -   Contains the full `plugin` object definition.
    -   The `id` inside this object is `"claw-kanban"`.
    -   Ends with `export default plugin;`.
-   **`~/Downloads/projects/claw-kanban/tsup.config.ts`**:
    -   `entry: ['src/index.ts']`
    -   `format: ['esm']`
-   **`~/.openclaw/openclaw.json`**:
    -   Use `plugins.entries["claw-kanban"]` when manually configuring (not `kanban`).
-   **Installation Directory**:
    -   `~/.openclaw/extensions/claw-kanban/` (Directory name should match the ID).

