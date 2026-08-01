// @ts-nocheck
// UNO ToolPkg 主入口：注册 XML 渲染插件，让 AI 通过 <uno> 标签唤起对战 UI
// 数据在 onXmlRender 中提前从文件构造好，UI 开箱即渲染，避免异步读文件卡加载。
import uno_ui from "./ui/uno.ui.js";
import uno_settings_ui from "./ui/uno_settings.ui.js";

var _sessionId = String(Date.now());

function registerToolPkg() {
  ToolPkg.registerXmlRenderPlugin({ id: "uno_render", tag: "uno", function: onXmlRender });
  // UNO 规则设置工具箱 UI（读写环境变量）
  ToolPkg.registerToolboxUiModule({
    id: "uno_settings",
    runtime: "compose_dsl",
    screen: uno_settings_ui,
    params: {},
    title: { zh: "UNO 规则设置", en: "UNO Rules" },
  } as any);
  return true;
}

// 读取游戏状态文件（main 上下文同步读，含行号过滤）
function readGameState(gameId: string): any {
  if (!gameId) return null;
  var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
  try {
    var raw = NativeInterface.callTool("", "read_file", JSON.stringify({ path: path }));
    if (!raw) return null;
    var obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    var content = (obj && obj.data && obj.data.content) || (obj && obj.content) || null;
    if (content && typeof content !== "string") content = JSON.stringify(content);
    if (content) {
      // 去掉每行开头的 "行号|" 前缀（Operit read_file 的格式）
      content = content.replace(/^\d+\|/gm, "");
      return JSON.parse(content);
    }
    return null;
  } catch (e) { return null; }
}

function parseAttrs(attrStr: string): Record<string, string> {
  var attrs: Record<string, string> = {};
  var re = /([\w-]+)\s*=\s*"([^"]*)"/g;
  var m;
  while ((m = re.exec(attrStr)) !== null) { attrs[m[1]] = m[2]; }
  var re2 = /([\w-]+)\s*=\s*'([^']*)'/g;
  while ((m = re2.exec(attrStr)) !== null) { attrs[m[1]] = m[2]; }
  return attrs;
}

function onXmlRender(event: any) {
  var payload = event.eventPayload || {};
  if (payload.tagName !== "uno") return { handled: false };

  var xmlContent = String(payload.xmlContent || "");
  var gameId = "";
  var title = "";

  // 解析属性写法 <uno gameId="xxx" title="..."/>
  var attrs: Record<string, string> = {};
  var outerMatch = xmlContent.match(/<uno\s+([^>]*)>/i);
  if (outerMatch) attrs = parseAttrs(outerMatch[1]);

  // 解析内部 JSON { "gameId": "...", "title": "..." }
  var contentMatch = xmlContent.match(/<uno[^>]*>([\s\S]*?)<\/uno>/i);
  if (contentMatch) {
    var inner = contentMatch[1].trim();
    if (inner) {
      try {
        var parsed = JSON.parse(inner);
        if (parsed && parsed.gameId) gameId = String(parsed.gameId);
        if (parsed && parsed.title) title = String(parsed.title);
      } catch (e) { /* 忽略 */ }
    }
  }
  if (!gameId && attrs.gameId) gameId = attrs.gameId;
  if (!title && attrs.title) title = attrs.title;

  // ⭐ 提前构造游戏数据：读文件 → 行号过滤 → 塞进 state，UI 开箱即渲染
  var game = readGameState(gameId);
  var chatId = (typeof getChatId === "function") ? getChatId() : "";
  var fp = simpleHash("uno_" + gameId + "_" + Date.now());

  var data = {
    gameId: gameId,
    title: title,
    game: game ? JSON.stringify(game) : null,
    gameLoaded: !!game,
  };

  return {
    handled: true,
    composeDsl: {
      screen: uno_ui,
      state: {
        _data: JSON.stringify(data),
        _chatId: chatId,
        _sessionId: _sessionId,
        _submitted: false,
        _resultMsg: "",
        _errorMsg: "",
        _chosen: "{}",
      },
      memo: { fingerprint: fp },
      moduleSpec: { id: "uno_" + fp, runtime: "compose_dsl" },
    },
  };
}

function simpleHash(input: string): string {
  if (!input) return "empty";
  var hash = 0;
  for (var i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  return "u" + (hash >>> 0);
}

export { registerToolPkg, onXmlRender };