import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Helper to get the __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the structure of a template
interface TaskTemplate {
  name: string;
  description: string;
  tags: string[];
  subtasks: { title: string; done: boolean }[];
}

/**
 * Loads a task template from the templates directory.
 * THIS IS THE KEY CHANGE: We now look relative to the compiled output root.
 * The compiled loader will be in a file like /dist/chunk-XYZ.js, so we go
 * up one level to /dist/ and then down to /templates/
 * @param templateName The name of the template file (e.g., "keyword-research")
 * @returns The template object or null if not found.
 */
export function loadTemplate(templateName: string): TaskTemplate | null {
  // When executed, __dirname is inside the 'dist' folder.
  // We copy the templates folder into dist during the build process.
  // So the structure is: dist/templates/[name].json
  const templatePath = path.resolve(__dirname, 'templates', `${templateName}.json`);

  try {
    if (fs.existsSync(templatePath)) {
      const fileContent = fs.readFileSync(templatePath, "utf-8");
      const template = JSON.parse(fileContent) as TaskTemplate;
      return template;
    } else {
      // Add some debugging to see where it's looking
      console.log(`[Kanban] Template not found. Looked in: ${templatePath}`);
    }
  } catch (error) {
    console.error(`[Kanban] Error loading template ${templateName}:`, error);
  }

  return null;
}
