// 游戏 JSON 存储层（适配 Tools.Files / NativeInterface 双环境）
import { GAME_DIR, UnoGameState, newGameState, shuffle, UnoRules } from "./game";

export function gameFileName(gameId: string): string {
  return GAME_DIR + "/" + gameId + ".json";
}

// 统一的文件内容读取
async function readText(path: string): Promise<string | null> {
  // 优先用 Tools.Files（工具脚本上下文）
  const g: any = globalThis as any;
  if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.read === "function") {
    try {
      const r: any = await g.Tools.Files.read(path);
      const content = r && (r.content !== undefined ? r.content : r.data && r.data.content);
      if (content === undefined || content === null) return null;
      return typeof content === "string" ? content : JSON.stringify(content);
    } catch (e) { return null; }
  }
  // 回退 NativeInterface
  if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
    try {
      const raw: any = await g.NativeInterface.callTool("", "read_file", JSON.stringify({ path }));
      if (!raw) return null;
      let obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (obj && typeof obj.data === "string") obj = JSON.parse(obj.data);
      const content = obj && (obj.content !== undefined ? obj.content : obj.data && obj.data.content);
      return content !== undefined && content !== null ? String(content) : null;
    } catch (e) { return null; }
  }
  return null;
}

async function writeText(path: string, content: string): Promise<boolean> {
  const g: any = globalThis as any;
  if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.write === "function") {
    try {
      const r: any = await g.Tools.Files.write(path, content);
      return !!(r && (r.success !== false));
    } catch (e) { return false; }
  }
  if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
    try {
      const raw: any = await g.NativeInterface.callTool("", "write_file", JSON.stringify({ path, content }));
      return !!raw;
    } catch (e) { return false; }
  }
  return false;
}

async function makeDir(path: string): Promise<void> {
  const g: any = globalThis as any;
  if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.makeDirectory === "function") {
    try { await g.Tools.Files.makeDirectory(path, true); } catch (e) {}
  } else if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
    try { await g.NativeInterface.callTool("", "make_directory", JSON.stringify({ path })); } catch (e) {}
  }
  // 若两者都不可用，尝试临时写一个文件探测（write 在多数实现会自动创建父目录）
  if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.write === "function") {
    try { await g.Tools.Files.write(path + "/.dir_probe", "1"); } catch (e) {}
  }
}

export async function listGameIds(): Promise<string[]> {
  const g: any = globalThis as any;
  const ids: string[] = [];
  if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.list === "function") {
    try {
      const r: any = await g.Tools.Files.list?.(GAME_DIR) ?? await g.Tools.Files.list(GAME_DIR, "android");
      const list = r && (r.files || r.entries || r.data || []);
      const arr = Array.isArray(list) ? list : Array.isArray(r) ? r : (list && list.list) || [];
      for (const item of arr) {
        const name = typeof item === "string" ? item : (item && (item.name || item.path)) || "";
        if (typeof name === "string" && name.endsWith(".json")) ids.push(name.replace(/\.json$/, ""));
      }
      return ids;
    } catch (e) { return ids; }
  }
  return ids;
}

export async function loadGame(gameId: string): Promise<UnoGameState | null> {
  try {
    const text = await readText(gameFileName(gameId));
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed || !parsed.gameId) return null;
    return parsed as UnoGameState;
  } catch (e) { return null; }
}

export async function saveGame(state: UnoGameState): Promise<boolean> {
  state.updated = Date.now();
  return writeText(gameFileName(state.gameId), JSON.stringify(state));
}

export async function createGame(gameId: string, firstTurn?: "ai" | "user", rules?: UnoRules): Promise<{ ok: boolean; message: string; state?: UnoGameState }> {
  if (invalidGameId(gameId)) {
    return { ok: false, message: "游戏实例 ID 含非法字符或长度非法（仅允许字母数字下划线，1~64字符）" };
  }
  await makeDir(GAME_DIR);
  const existing = await loadGame(gameId);
  if (existing) {
    return { ok: false, message: "游戏实例 ID 已存在: " + gameId };
  }
  const state = newGameState(gameId, firstTurn, rules);
  const ok = await saveGame(state);
  if (!ok) return { ok: false, message: "无法写入游戏文件，请检查存储目录权限" };
  return { ok: true, message: "游戏已创建", state };
}

// 校验游戏 ID 合法性
export function invalidGameId(id: string): boolean {
  return !id || id.length > 64 || !/^[a-zA-Z0-9_\-]+$/.test(id);
}

export async function deleteGame(gameId: string): Promise<boolean> {
  const g: any = globalThis as any;
  if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.deleteFile === "function") {
    try { await g.Tools.Files.deleteFile?.(gameFileName(gameId)); await g.Tools.Files.deleteFile(gameFileName(gameId), true); return true; } catch (e) {}
  }
  if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
    try { await g.NativeInterface.callTool("", "delete_file", JSON.stringify({ path: gameFileName(gameId) })); return true; } catch (e) {}
  }
  return false;
}