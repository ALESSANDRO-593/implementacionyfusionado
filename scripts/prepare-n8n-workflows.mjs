import fs from "node:fs";
import path from "node:path";

const roots = [
  "certificado-de-matricula-app-main/n8n-backend/workflows",
  "Mesa-de-ayuda-n8n-main/n8n/workflows",
  "parqueadero-admin-web/n8n/workflows",
];

const output = ".n8n-deploy/workflows";

function readJson(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function findJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`No existe la carpeta: ${directory}`);
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findJsonFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

const ids = readJson("scripts/n8n-workflow-ids.json");
const credentialIds = readJson("scripts/n8n-credential-ids.json");
const workflows = [];
const usedNames = new Map();
const usedIds = new Map();
const usedRoutes = new Map();

for (const root of roots) {
  for (const file of findJsonFiles(root)) {
    const workflow = readJson(file);

    if (!workflow.name || !Array.isArray(workflow.nodes)) {
      continue;
    }

    if (workflow.name === "App Matrícula - Resetear Contraseña de Correo Institucional (automático)") {
      console.log(`OMITIDO_NO_OPERATIVO=${workflow.name}`);
      continue;
    }

    const id = ids[workflow.name];

    if (!id) {
      throw new Error(`Falta ID para: ${workflow.name} (${file})`);
    }

    if (usedNames.has(workflow.name)) {
      throw new Error(`Nombre duplicado: ${workflow.name}`);
    }

    if (usedIds.has(id)) {
      throw new Error(`ID duplicado: ${id}`);
    }

    workflow.id = id;

    for (const node of workflow.nodes) {
      if (!node.credentials) {
        continue;
      }

      for (const [type, current] of Object.entries(node.credentials)) {
        const incomplete =
          current?.id === "REEMPLAZAR" ||
          String(current?.name ?? "").includes("REEMPLAZAR");

        if (!incomplete) {
          continue;
        }

        const replacement = credentialIds[type];

        if (!replacement) {
          throw new Error(
            `No existe credencial configurada para ${type} en ${workflow.name}`
          );
        }

        node.credentials[type] = { ...replacement };
      }
    }

    const serialized = JSON.stringify(workflow);

    if (serialized.includes('"id":"REEMPLAZAR"')) {
      throw new Error(`El workflow contiene REEMPLAZAR: ${workflow.name}`);
    }

    for (const node of workflow.nodes) {
      if (!String(node.type ?? "").includes("webhook")) {
        continue;
      }

      const method = node.parameters?.httpMethod ?? "GET";
      const webhookPath = node.parameters?.path ?? "";
      const route = `${method} ${webhookPath}`;

      if (usedRoutes.has(route)) {
        throw new Error(
          `Webhook duplicado: ${route} en ${workflow.name} y ${usedRoutes.get(route)}`
        );
      }

      usedRoutes.set(route, workflow.name);
    }

    usedNames.set(workflow.name, file);
    usedIds.set(id, workflow.name);
    workflows.push(workflow);
  }
}

fs.rmSync(".n8n-deploy", { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const workflow of workflows) {
  const destination = path.join(output, `${workflow.id}.json`);
  fs.writeFileSync(destination, JSON.stringify(workflow, null, 2) + "\n");
}

console.log(`WORKFLOWS_PREPARADOS=${workflows.length}`);


