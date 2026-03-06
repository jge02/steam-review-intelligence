import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".cache");

export async function readJsonCache<T>(key: string): Promise<T | null> {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonCache<T>(key: string, value: T): Promise<void> {
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

