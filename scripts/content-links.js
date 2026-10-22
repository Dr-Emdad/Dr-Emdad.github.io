#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "content";
const DOCS = "generated/docs";
const REPO = "Dr-Emdad/Dr-Emdad.github.io";
const BRANCH = "pages";
const FILE_TYPES = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);

const rawGithubBase = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;

function encodeJsdelivrPath(fileRel) {
  return fileRel
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else {
      files.push(full);
    }
  }

  return files;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function generateIndex(dir) {
  const relative = path.relative(ROOT, dir);
  const outDir = relative ? path.join(DOCS, relative) : DOCS;

  await ensureDir(outDir);
  const outFile = path.join(outDir, "index.md");

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const docs = entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      return FILE_TYPES.has(path.extname(entry.name).toLowerCase());
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const title = relative ? path.basename(relative) : "Home";

  let md = `---
title: ${title}
---

# ${title}

`;

  if (folders.length) {
    md += "## Folders\n\n";
    for (const folder of folders) {
      md += `- [📁 ${folder.name}](./${folder.name}/)\n`;
    }
    md += "\n";
  }

  if (docs.length) {
    md += "## Documents\n\n";
    md += "| Name | Open | Office |\n";
    md += "| ---- | ---- | ------ |\n";

    for (const doc of docs) {
      const filePath = path.join(dir, doc.name);
      const fileRel = path.relative(ROOT, filePath).split(path.sep).join("/");
      const rawUrl = `${rawGithubBase}${encodeJsdelivrPath(fileRel)}`;
      const officeUrl =
        "https://view.officeapps.live.com/op/view.aspx?src=" +
        encodeURIComponent(rawUrl);

      const name = path.parse(doc.name).name;
      const ext = path.extname(doc.name).toLowerCase();

      const officeCell = ext === ".pdf"
        ? "-"
        : `[Office](${officeUrl})`;

      md += `| ${name} | [Open](${rawUrl}) | ${officeCell} |\n`;
    }

    md += "\n";
  }

  await fs.writeFile(outFile, md);
}

async function main() {
  await fs.rm(DOCS, { recursive: true, force: true });
  await fs.mkdir(DOCS, { recursive: true });

  const rootExists = await fs.stat(ROOT).then(() => true).catch(() => false);
  if (!rootExists) {
    console.log("No content directory found; nothing to index.");
    return;
  }

  const allFiles = await walk(ROOT);
  const directories = new Set(allFiles.map((file) => path.dirname(file)));

  for (const dir of [...directories].sort()) {
    if (dir === ROOT || dir.startsWith(`${ROOT}${path.sep}`)) {
      await generateIndex(dir);
    }
  }

  await generateIndex(ROOT);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
