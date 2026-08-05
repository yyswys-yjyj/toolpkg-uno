"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameFileName = gameFileName;
exports.listGameIds = listGameIds;
exports.loadGame = loadGame;
exports.saveGame = saveGame;
exports.createGame = createGame;
exports.invalidGameId = invalidGameId;
exports.deleteGame = deleteGame;
// 游戏 JSON 存储层（适配 Tools.Files / NativeInterface 双环境）
const game_1 = require("./game");
function gameFileName(gameId) {
    return game_1.GAME_DIR + "/" + gameId + ".json";
}
// 统一的文件内容读取
async function readText(path) {
    // 优先用 Tools.Files（工具脚本上下文）
    const g = globalThis;
    if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.read === "function") {
        try {
            const r = await g.Tools.Files.read(path);
            const content = r && (r.content !== undefined ? r.content : r.data && r.data.content);
            if (content === undefined || content === null)
                return null;
            return typeof content === "string" ? content : JSON.stringify(content);
        }
        catch (e) {
            return null;
        }
    }
    // 回退 NativeInterface
    if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
        try {
            const raw = await g.NativeInterface.callTool("", "read_file", JSON.stringify({ path }));
            if (!raw)
                return null;
            let obj = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (obj && typeof obj.data === "string")
                obj = JSON.parse(obj.data);
            const content = obj && (obj.content !== undefined ? obj.content : obj.data && obj.data.content);
            return content !== undefined && content !== null ? String(content) : null;
        }
        catch (e) {
            return null;
        }
    }
    return null;
}
async function writeText(path, content) {
    const g = globalThis;
    if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.write === "function") {
        try {
            const r = await g.Tools.Files.write(path, content);
            return !!(r && (r.success !== false));
        }
        catch (e) {
            return false;
        }
    }
    if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
        try {
            const raw = await g.NativeInterface.callTool("", "write_file", JSON.stringify({ path, content }));
            return !!raw;
        }
        catch (e) {
            return false;
        }
    }
    return false;
}
async function makeDir(path) {
    const g = globalThis;
    if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.makeDirectory === "function") {
        try {
            await g.Tools.Files.makeDirectory(path, true);
        }
        catch (e) { }
    }
    else if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
        try {
            await g.NativeInterface.callTool("", "make_directory", JSON.stringify({ path }));
        }
        catch (e) { }
    }
    // 若两者都不可用，尝试临时写一个文件探测（write 在多数实现会自动创建父目录）
    if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.write === "function") {
        try {
            await g.Tools.Files.write(path + "/.dir_probe", "1");
        }
        catch (e) { }
    }
}
async function listGameIds() {
    const g = globalThis;
    const ids = [];
    if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.list === "function") {
        try {
            const r = await g.Tools.Files.list?.(game_1.GAME_DIR) ?? await g.Tools.Files.list(game_1.GAME_DIR, "android");
            const list = r && (r.files || r.entries || r.data || []);
            const arr = Array.isArray(list) ? list : Array.isArray(r) ? r : (list && list.list) || [];
            for (const item of arr) {
                const name = typeof item === "string" ? item : (item && (item.name || item.path)) || "";
                if (typeof name === "string" && name.endsWith(".json"))
                    ids.push(name.replace(/\.json$/, ""));
            }
            return ids;
        }
        catch (e) {
            return ids;
        }
    }
    return ids;
}
async function loadGame(gameId) {
    try {
        const text = await readText(gameFileName(gameId));
        if (!text)
            return null;
        const parsed = JSON.parse(text);
        if (!parsed || !parsed.gameId)
            return null;
        return parsed;
    }
    catch (e) {
        return null;
    }
}
async function saveGame(state) {
    state.updated = Date.now();
    return writeText(gameFileName(state.gameId), JSON.stringify(state));
}
async function createGame(gameId, firstTurn, rules) {
    if (invalidGameId(gameId)) {
        return { ok: false, message: "游戏实例 ID 含非法字符或长度非法（仅允许字母数字下划线，1~64字符）" };
    }
    await makeDir(game_1.GAME_DIR);
    const existing = await loadGame(gameId);
    if (existing) {
        return { ok: false, message: "游戏实例 ID 已存在: " + gameId };
    }
    const state = (0, game_1.newGameState)(gameId, firstTurn, rules);
    const ok = await saveGame(state);
    if (!ok)
        return { ok: false, message: "无法写入游戏文件，请检查存储目录权限" };
    return { ok: true, message: "游戏已创建", state };
}
// 校验游戏 ID 合法性
function invalidGameId(id) {
    return !id || id.length > 64 || !/^[a-zA-Z0-9_\-]+$/.test(id);
}
async function deleteGame(gameId) {
    const g = globalThis;
    if (typeof g.Tools !== "undefined" && g.Tools && g.Tools.Files && typeof g.Tools.Files.deleteFile === "function") {
        try {
            await g.Tools.Files.deleteFile?.(gameFileName(gameId));
            await g.Tools.Files.deleteFile(gameFileName(gameId), true);
            return true;
        }
        catch (e) { }
    }
    if (typeof g.NativeInterface !== "undefined" && g.NativeInterface && typeof g.NativeInterface.callTool === "function") {
        try {
            await g.NativeInterface.callTool("", "delete_file", JSON.stringify({ path: gameFileName(gameId) }));
            return true;
        }
        catch (e) { }
    }
    return false;
}
