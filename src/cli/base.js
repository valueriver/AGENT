import path from "path";
import { mkdir, readdir } from "fs/promises";
import { BASES_DIR } from "./constants.js";

const listBaseIds = async () => {
  await mkdir(BASES_DIR, { recursive: true });
  const entries = await readdir(BASES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
};

const resolveBaseId = async (baseRef) => {
  const ids = await listBaseIds();
  if (!baseRef) {
    return (ids.at(-1) || 0) + 1;
  }
  if (baseRef === "-1") {
    const latest = ids.at(-1);
    if (!latest) {
      throw new Error("No bases found");
    }
    return latest;
  }
  const id = Number(baseRef);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid base id: ${baseRef}`);
  }
  return id;
};

const openBase = async (baseRef, systemPrompt) => {
  const baseId = await resolveBaseId(baseRef);
  const dir = path.join(BASES_DIR, String(baseId));
  await mkdir(dir, { recursive: true });
  return {
    baseId,
    baseDir: dir,
    systemPrompt
  };
};

export { openBase };
