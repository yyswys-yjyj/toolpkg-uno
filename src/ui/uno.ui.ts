// @ts-nocheck
// UNO 对战 UI：数据由 main 的 onXmlRender 提前构造好放进 state._data.game，
// 结算统一调用 game.js（与 AI 侧共享，保证规则/stacking/质疑一致）
import * as unoGame from "../game";

function _colorHex(col: string): string {
  var m = { red: "#E53935", blue: "#1E88E5", green: "#43A047", yellow: "#FDD835", wild: "#37474F" };
  return m[col] || "#9E9E9E";
}
function _colorName(col: string): string {
  var m = { red: "红", blue: "蓝", green: "绿", yellow: "黄", wild: "万能" };
  return m[col] || col;
}
function _valueName(v: string): string {
  var m = { skip: "跳过", reverse: "反转", draw2: "+2", wild: "换色", wild4: "+4" };
  return m[v] || v;
}
function _cardLabel(c: any): string {
  if (!c) return "";
  if (c.color === "wild") return c.value === "wild4" ? "万能+4" : "万能";
  return _colorName(c.color) + " " + (_valueName(c.value) || String(c.value));
}
function _parseHex(hex: string, alpha: number): string {
  // 直接返回 hex 色值（Compose color 用 #RRGGBB 更可靠，rgba() 可能不被支持）
  return hex;
}
function _tickColor(cardColor: string): string {
  // 仅用于文案色，避免和牌背混淆
  return _colorHex(cardColor);
}

// 本地结算（与 game.ts 一致，供按钮点击同步处理）
function _canPlay(c: any, ac: any, tp: any): boolean {
  if (!c || !tp) return false;
  if (c.color === "wild") return true;
  if (c.color === ac) return true;
  if (c.value === tp.value) return true;
  return false;
}
function _pickColor(hand: any[], fallback: any): any {
  var counts: any = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (var i = 0; i < hand.length; i++) { var c = hand[i]; if (c.color !== "wild") counts[c.color] = (counts[c.color] || 0) + 1; }
  var best: any = null, bn = -1;
  for (var k of ["red", "blue", "green", "yellow"]) { if (counts[k] > bn) { bn = counts[k]; best = k; } }
  return best || fallback || "red";
}
function _drawOne(st: any, who: string): any {
  if (st.deck.length === 0) {
    if (st.pile.length <= 1) return null;
    var t = st.pile.pop();
    st.pile = [t];
    // 洗牌
    var a = st.pile.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    st.deck = a;
  }
  var c = st.deck.pop();
  if (!c) return null;
  st.players[who].push(c);
  return c;
}

export default function Screen(ctx: any) {
  var dataState = ctx.useState("_data", "{}");
  var chatIdState = ctx.useState("_chatId", "");
  var submittedState = ctx.useState("_submitted", false);
  var resultMsgState = ctx.useState("_resultMsg", "");
var errorMsgState = ctx.useState("_errorMsg", "");
// 消息附加：用户在出牌/罚牌时附加的一段话，随动作发给 AI 查看
var attachMsgState = ctx.useState("_attachMsg", "");
  var chosenState = ctx.useState("_chosen", "{}");
  // abd 中间态：记录用户放弃后抽到的牌（仅用户可见，点"继续"后才发消息、明牌不出）
  var abandonDrawnState = ctx.useState("_abandonDrawn", "null");
  // 万能牌选色中间态：记录待出的牌 + 是否在选色（可取消返回）
  var wildPickState = ctx.useState("_wildPick", "null");
  // 选色中间态里当前选中的颜色（单选，点"确认"才生效）
  var wildColorState = ctx.useState("_wildColor", "");

  // ⭐ 数据已在 main 提前构造，开箱即用
  var data: any = {};
  try { data = JSON.parse(dataState[0] || "{}"); } catch (e) { data = {}; }
  var game: any = null;
  if (data.game) { try { game = JSON.parse(data.game); } catch (e) { game = null; } }

  var gameId = data.gameId || (game && game.gameId) || "";
  var chatId = chatIdState[0] || "";

  var primary = ctx.MaterialTheme.colorScheme.primary;
  var onSurface = ctx.MaterialTheme.colorScheme.onSurface;
  var onSurfaceVariant = ctx.MaterialTheme.colorScheme.onSurfaceVariant;
  var errorColor = ctx.MaterialTheme.colorScheme.error;

  var chosen: Record<string, boolean> = {};
  try { Object.assign(chosen, JSON.parse(chosenState[0] || "{}")); } catch (e) {}

  var submitted = submittedState[0];
  var resultMsg = resultMsgState[0];
  var errorMsg = errorMsgState[0];
  // 消息附加：用户在出牌/罚牌时附加的一段话，随动作发给 AI
  var attachMsg = String(attachMsgState[0] || "").trim();
  // 抽牌中间态：抽到的牌（仅用户可见）或 null
  var abandonDrawn: any = null;
  try { var ad = JSON.parse(abandonDrawnState[0] || "null"); abandonDrawn = ad ? ad : null; } catch (e) { abandonDrawn = null; }
  var isAbandoning = !!abandonDrawn; // 是否处于"已抽牌待继续"中间态
  // 万能牌选色中间态
  var wildPick: any = null;
  try { var wp = JSON.parse(wildPickState[0] || "null"); wildPick = wp ? wp : null; } catch (e) { wildPick = null; }
  var isPickingWild = !!wildPick; // 是否处于"万能牌选色"中间态
  var wildColor = wildColorState[0] || ""; // 当前选中的颜色（单选）

  // ── 从构造好的 game 读取 ──
  var myHand = (game && game.players && game.players.user) || [];
  var top = (game && game.pile && game.pile.length > 0) ? game.pile[game.pile.length - 1] : null;
  var activeColor = game ? (game.activeColor || "") : "";
  var currentTurn = game ? game.currentTurn : "";
  var winner = game ? game.winner : null;
  var aiCount = (game && game.players && game.players.ai) ? game.players.ai.length : 0;

  var isUserTurn = currentTurn === "user" && !winner;
  var isOver = !!winner;
  var gameMissing = !data.gameLoaded && !game; // 文件不存在
  var gameEnded = isOver || (submitted && winner);
  // pendingReveal（用户被打方需确认：+2 确认 / +4 确认或质疑）
  var pending = (game && game.pendingReveal) || null;
  var isUserPenalized = !!pending && pending.target === "user";

  function toggleChosen(cardId: string) {
    var nc: any = {};
    try { Object.assign(nc, JSON.parse(chosenState[0] || "{}")); } catch (e) {}
    nc[cardId] = !nc[cardId];
    chosenState[1](JSON.stringify(nc)); // setState → 重绘
  }

  async function saveResult(msg: string) {
    // 若有用户附加消息，拼接进去一并发给 AI（附加发送后清空，避免重复）
    var attach = String(attachMsgState[0] || "").trim();
    if (attach) {
      msg = msg + "\n📎 附加消息：" + attach;
      attachMsgState[1]("");
    }
    try { await Tools.Chat.sendMessage(msg, chatId, undefined, undefined, { runtime: "main" }); } catch (e) {}
  }

  // 出牌：读最新 json（只此一处异步读，且是用户主动操作，非首次渲染）
  async function handlePlay() {
    if (!isUserTurn || submitted || isAbandoning) return;
    var chosenIds: string[] = [];
    for (var k in chosen) { if (chosen[k]) chosenIds.push(k); }
    if (chosenIds.length === 0) {
      errorMsgState[1]("请先选择要打出的卡牌，或点击“放弃本轮”。");
      return;
    }
    errorMsgState[1]("");
    // 从文件读最新状态（用户点按钮时才读，避免首次渲染卡加载）
    var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
    var st: any = { players: { ai: [], user: [] }, pile: [], deck: [], activeColor: "", currentTurn: "user", winner: null };
    try {
      var raw = await ctx.callTool("read_file", { path: path });
      var content = raw && (raw.content !== undefined ? raw.content : (raw.data && raw.data.content));
      if (content) {
        if (typeof content !== "string") content = JSON.stringify(content);
        content = content.replace(/^\d+\|/gm, "");
        st = JSON.parse(content);
      }
    } catch (e) {}
    if (st.winner || st.currentTurn !== "user") {
      errorMsgState[1]("当前不在你的回合或游戏已结束。");
      return;
    }
    // ⭐ 万能牌选色中间态：如果选中的牌含 wild/wild4，先进入选色（暂不结算，可取消返回）
    var pickedWild = false;
    for (var wi = 0; wi < chosenIds.length; wi++) {
      var wc = st.players.user.find(function (h: any) { return h.id === chosenIds[wi]; });
      if (wc && wc.color === "wild") { pickedWild = true; break; }
    }
    if (pickedWild) {
      wildPickState[1](JSON.stringify({ ids: chosenIds }));
      return; // 进入选色中间态，等用户确认颜色再真正出牌
    }
    // 结算（统一调 game.js，保证与 AI 规则一致）
    var r = unoGame.playCards(st, "user", chosenIds);
    if (!r.ok) { errorMsgState[1](r.message); return; }
    await ctx.callTool("write_file", { path: path, content: JSON.stringify(st) }).catch(function(){});
    chosenState[1]("{}");
    submittedState[1](true); // 出牌完成 → 进入"已出牌"模态页
    // 若进入 pendingPenalty（用户打了罚牌，AI 手中有同类可接招）→ 不发 UNO，保持 UI 让 AI/用户继续
    if (r.pendingPenalty) {
      submittedState[1](true);
      resultMsgState[1](r.message);
      await saveResult(r.message);
      return;
    }
    var sentMsg = r.message + (r.won ? " 🎉 用户赢了！" : "");
    // ⭐ UNO!：打完牌手牌剩最后 1 张时喊 UNO（标准规则）
    if (!r.won && st.players.user.length === 1) {
      sentMsg += "  🎯 UNO!";
    }
    resultMsgState[1](sentMsg);
    await saveResult(sentMsg);
  }

  // 放弃本轮：抽牌 → 写回状态 → 进入"展示抽到的牌 + 继续"中间态（暂不发消息，防明牌）
  async function handleAbandon() {
    if (!isUserTurn || submitted || isAbandoning) return;
    errorMsgState[1]("");
    var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
    var st: any = { players: { ai: [], user: [] }, pile: [], deck: [], activeColor: "", currentTurn: "user", winner: null };
    try {
      var raw = await ctx.callTool("read_file", { path: path });
      var content = raw && (raw.content !== undefined ? raw.content : (raw.data && raw.data.content));
      if (content) {
        if (typeof content !== "string") content = JSON.stringify(content);
        content = content.replace(/^\d+\|/gm, "");
        st = JSON.parse(content);
      }
    } catch (e) {}
    if (st.winner || st.currentTurn !== "user") {
      errorMsgState[1]("当前不在你的回合或游戏已结束。");
      return;
    }
    // 是否认罚（存在针对用户的 pendingPenalty）
    var isPenalty = !!(st.pendingPenalty && st.pendingPenalty.target === "user");
    var beforeHand = (st.players.user || []).length;
    var r = unoGame.abandonTurn(st, "user"); // 统一结算（含认罚抽累计）
    await ctx.callTool("write_file", { path: path, content: JSON.stringify(st) }).catch(function(){});
    chosenState[1]("{}");
    if (isPenalty) {
      // 认罚：抽累计张数，不进单张展示，直接提示
      submittedState[1](true);
      resultMsgState[1](r.message);
      await saveResult(r.message);
      return;
    }
    // 普通弃牌抽1张：展示抽到的牌到中间态（仅用户可见）
    var newHand = st.players.user || [];
    var drawn = newHand.length > beforeHand ? newHand[newHand.length - 1] : null;
    abandonDrawnState[1](drawn ? JSON.stringify(drawn) : "null");
    errorMsgState[1]("");
  }

  // 用户看完抽到的牌点"继续"：才发消息（不透露明牌），结束中间态
  async function continueAfterAbandon() {
    if (!isAbandoning) return;
    abandonDrawnState[1]("null");
    submittedState[1](true);
    resultMsgState[1]("用户放弃出牌，抽了 1 张");
    await saveResult("用户放弃出牌，抽了 1 张");
  }

  // 万能牌选色：点颜色只是选中（单选）
  function selectWildColor(color: string) {
    if (!isPickingWild) return;
    wildColorState[1](color);
  }

  // 万能牌选色确认：用当前选中的颜色真正出牌并结算
  async function confirmWildColor() {
    if (!isPickingWild || !wildPick || !wildPick.ids) return;
    var color = wildColorState[0] || "";
    if (!color) {
      errorMsgState[1]("请先选择一个生效颜色。");
      return;
    }
    errorMsgState[1]("");
    var ids = wildPick.ids;
    var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
    var st: any = { players: { ai: [], user: [] }, pile: [], deck: [], activeColor: "", currentTurn: "user", winner: null };
    try {
      var raw = await ctx.callTool("read_file", { path: path });
      var content = raw && (raw.content !== undefined ? raw.content : (raw.data && raw.data.content));
      if (content) {
        if (typeof content !== "string") content = JSON.stringify(content);
        content = content.replace(/^\d+\|/gm, "");
        st = JSON.parse(content);
      }
    } catch (e) {}
    if (st.winner || st.currentTurn !== "user") {
      errorMsgState[1]("当前不在你的回合或游戏已结束。");
      wildPickState[1]("null");
      wildColorState[1]("");
      return;
    }
    // 用选定颜色结算（调 game.js）
    var r = unoGame.playCards(st, "user", ids, color);
    if (!r.ok) { errorMsgState[1](r.message); wildPickState[1]("null"); wildColorState[1](""); return; }
    try { await ctx.callTool("write_file", { path: path, content: JSON.stringify(st) }); } catch (e) {}
    wildPickState[1]("null");
    wildColorState[1]("");
    chosenState[1]("{}");
    submittedState[1](true);
    // 若进入 pendingPenalty，保持提示
    var sentMsg = r.message + (r.won ? " 🎉 用户赢了！" : "");
    if (!r.won && st.players.user.length === 1) { sentMsg += "  🎯 UNO!"; }
    resultMsgState[1](sentMsg);
    await saveResult(sentMsg);
  }

  // 万能牌选色取消：返回正常出牌界面（可换牌再出）
  function cancelWildPick() {
    if (!isPickingWild) return;
    wildPickState[1]("null");
    wildColorState[1]("");
    errorMsgState[1]("");
  }

  // 用户确认罚牌（+2/+4）：确认后预取牌加入并继续
  async function confirmReveal() {
    if (!isUserPenalized) return;
    errorMsgState[1]("");
    var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
    var st: any = { players: { ai: [], user: [] }, pile: [], deck: [], activeColor: "", currentTurn: "user", winner: null };
    try {
      var raw = await ctx.callTool("read_file", { path: path });
      var content = raw && (raw.content !== undefined ? raw.content : (raw.data && raw.data.content));
      if (content) {
        if (typeof content !== "string") content = JSON.stringify(content);
        content = content.replace(/^\d+\|/gm, "");
        st = JSON.parse(content);
      }
    } catch (e) {}
    if (!st.pendingReveal || st.pendingReveal.target !== "user") return;
    var r = unoGame.acceptReveal(st, "user");
    if (!r.ok) { errorMsgState[1](r.message); return; }
    await ctx.callTool("write_file", { path: path, content: JSON.stringify(st) }).catch(function(){});
    submittedState[1](true);
    resultMsgState[1](r.message);
    await saveResult(r.message);
  }

  // 用户接招叠加：用手里同类 +2/+4 反击（需开启 stacking，且与罚牌同类型）
  async function stackReveal(cardId: string) {
    if (submitted) return;
    errorMsgState[1]("");
    var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
    var st: any = { players: { ai: [], user: [] }, pile: [], deck: [], activeColor: "", currentTurn: "user", winner: null };
    try {
      var raw = await ctx.callTool("read_file", { path: path });
      var content = raw && (raw.content !== undefined ? raw.content : (raw.data && raw.data.content));
      if (content) {
        if (typeof content !== "string") content = JSON.stringify(content);
        content = content.replace(/^\d+\|/gm, "");
        st = JSON.parse(content);
      }
    } catch (e) {}
    var revPending = st.pendingReveal;
    if (!revPending || revPending.target !== "user") { errorMsgState[1]("当前不是待确认罚牌状态"); return; }
    if (!st.rules || !st.rules.stacking) { errorMsgState[1]("未开启叠加规则，无法接招"); return; }
    // 该牌须与罚牌同类型
    var c = (st.players.user || []).find(function (h: any) { return h.id === cardId; });
    if (!c) { errorMsgState[1]("卡牌不存在"); return; }
    var sameKind = revPending.kind === "draw2" ? c.value === "draw2" : c.value === "wild4";
    if (!sameKind) { errorMsgState[1]("只能接招「同类罚牌」"); return; }
    var r = unoGame.playCards(st, "user", [cardId]);
    if (!r.ok) { errorMsgState[1](r.message); return; }
    await ctx.callTool("write_file", { path: path, content: JSON.stringify(st) }).catch(function(){});
    submittedState[1](true);
    resultMsgState[1](r.message);
    await saveResult(r.message);
  }

  // 用户质疑：仅当上一步是 AI 刚出 +4 时可质疑
  async function handleChallenge() {
    if (!isUserTurn || submitted) return;
    errorMsgState[1]("");
    var path = "/storage/emulated/0/Download/Operit/cleanOnExit/uno/" + gameId + ".json";
    var st: any = { players: { ai: [], user: [] }, pile: [], deck: [], activeColor: "", currentTurn: "user", winner: null };
    try {
      var raw = await ctx.callTool("read_file", { path: path });
      var content = raw && (raw.content !== undefined ? raw.content : (raw.data && raw.data.content));
      if (content) {
        if (typeof content !== "string") content = JSON.stringify(content);
        content = content.replace(/^\d+\|/gm, "");
        st = JSON.parse(content);
      }
    } catch (e) {}
    // 质疑前检查：上一步是 AI 出 wild4 且当前待处理
    var la = st.lastAction;
    if (!la || la.kind !== "wild4" || la.source !== "ai") {
      errorMsgState[1]("当前不能质疑：仅当对方刚出了 +4 时可质疑。");
      return;
    }
    var r = unoGame.challengeWild4(st, "user");
    if (!r.ok) { errorMsgState[1](r.message); return; }
    await ctx.callTool("write_file", { path: path, content: JSON.stringify(st) }).catch(function(){});
    submittedState[1](true);
    resultMsgState[1](r.message);
    await saveResult(r.message);
  }

  function localPlay(st: any, ids: string[], chosenColor?: string) {
    var top0 = st.pile[st.pile.length - 1];
    var hand = st.players.user;
    var cards: any[] = [];
    var seen: any = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var c = hand.find(function (h: any) { return h.id === id; });
      if (!c) return { ok: false, message: "卡牌不存在: " + id };
      if (seen[id]) return { ok: false, message: "重复选择卡牌: " + id };
      seen[id] = true;
      cards.push({ ...c });
    }
    if (cards.length > 1) {
      return { ok: false, message: "官方规则：一次只能打出一张牌" };
    }
    if (!_canPlay(cards[0], st.activeColor, top0)) {
      return { ok: false, message: "所选卡牌不符合当前牌面，无法打出" };
    }
    var idSet: any = {};
    for (var id2 of ids) idSet[id2] = true;
    st.players.user = hand.filter(function (h: any) { return !idSet[h.id]; });
    for (var c2 of cards) st.pile.push(c2);
    var played = cards[0];
    var msg = "用户出牌：" + cards.map(_cardLabel).join("、");
    var extra = 0;
    var skipAI = false; // AI 是否被跳过（skip/reverse/+2/+4）
    if (played.color === "wild") {
      var best = (chosenColor && ["red", "blue", "green", "yellow"].indexOf(chosenColor) >= 0)
        ? chosenColor : _pickColor(st.players.user, st.activeColor);
      st.activeColor = best;
      msg += "，指定" + _colorName(best) + "色";
    } else {
      st.activeColor = played.color;
    }
    // 成组出牌：效果叠加法——遍历整组累加 +2/+4 罚抽、跳过/反转叠加
    var extra = 0;
    var skipAI = false; // AI 是否被跳过（skip/reverse/+2/+4）
    var isPen = false;
    var penCount = 0;
    for (var gi = 0; gi < cards.length; gi++) {
      var gv = cards[gi].value;
      if (gv === "draw2") { extra += 2; skipAI = true; isPen = true; penCount++; }
      else if (gv === "wild4") { extra += 4; skipAI = true; isPen = true; penCount++; }
      else if (gv === "skip") { skipAI = true; }
      else if (gv === "reverse") { skipAI = true; } // 双人局 reverse 当跳过
    }
    if (isPen) {
      msg += "，AI 需罚抽 " + extra + " 张并被跳过";
      if (penCount > 1) msg += "（" + penCount + " 张罚牌叠加）";
    }
    if (skipAI && !isPen) msg += "，跳过 AI 回合";
    for (var e = 0; e < extra; e++) _drawOne(st, "ai");
    st.history = st.history || []; st.history.push(msg);
    st.updated = Date.now();
    if (st.players.user.length === 0) {
      st.winner = "user";
      st.history.push("🎉 你手牌清空，获胜！");
      return { ok: true, message: msg, won: true };
    }
    // 标准规则：skip/reverse/+2/+4 会让对方被跳过，因此仍轮用户（连出）；普通牌才轮到 AI
    st.currentTurn = skipAI ? "user" : "ai";
    return { ok: true, message: msg, won: false };
  }
  // ── 渲染 ──
  var nodes: any[] = [];

  // 消息附加组件：用户可填一段话随当前动作发给 AI 查看
  function renderAttachBox() {
    return ctx.UI.Column({ spacing: 4, fillMaxWidth: true }, [
      ctx.UI.Text({ text: "消息附加（可选，随动作发给 AI）", style: "labelSmall", color: onSurfaceVariant }),
      ctx.UI.TextField({
        value: attachMsgState[0] || "",
        onValueChange: function (newVal: string) { attachMsgState[1](newVal); },
        placeholder: "给 AI 捎句话，例如：这局我可不会手软 😏",
        singleLine: false,
        minLines: 2,
        maxLines: 5,
        style: "compact",
        fillMaxWidth: true,
      }),
    ]);
  }


  nodes.push(ctx.UI.Column({ spacing: 2, padding: { vertical: 4, horizontal: 4 } }, [
    ctx.UI.Text({ text: "🎴 UNO 对战", style: "titleLarge", color: primary }),
    gameId ? ctx.UI.Text({ text: "对局 #" + gameId, style: "bodySmall", color: onSurfaceVariant }) : null,
  ]));

  // 游戏不存在
  if (!gameId || gameMissing) {
    nodes.push(ctx.UI.Text({ text: "游戏不存在或已结束：未找到该实例文件", style: "bodyMedium", color: errorColor }));
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
  }

  // 当前牌面
  if (top) {
    var cHex = _colorHex(top.color);
    nodes.push(ctx.UI.Column({ spacing: 4, padding: { vertical: 6 } }, [
      ctx.UI.Text({ text: "当前牌面", style: "labelMedium", color: onSurfaceVariant }),
      ctx.UI.Row({ spacing: 10, verticalAlignment: "centerVertically" }, [
        ctx.UI.OutlinedCard({
          containerColor: _parseHex(cHex, 0.15),
          contentColor: _parseHex(cHex, 0.95),
          border: { width: 2, color: _parseHex(cHex, 0.9) },
          shape: { type: "rounded", cornerRadius: 8 },
          content: ctx.UI.Column({ spacing: 0, horizontalAlignment: "centerHorizontally", verticalArrangement: "center", width: 60, height: 78 }, [
            ctx.UI.Text({ text: _cardLabel(top), style: "titleMedium", color: _parseHex(cHex, 0.95), textAlign: "center" }),
          ]),
        }),
        ctx.UI.Column({ spacing: 2 }, [
          ctx.UI.Text({ text: "生效颜色: " + _colorName(activeColor), style: "bodyMedium", color: onSurface }),
          ctx.UI.Text({ text: "你手牌 " + myHand.length + " 张 | AI 手牌 " + aiCount + " 张", style: "bodySmall", color: onSurfaceVariant }),
        ]),
      ]),
    ]));
  }

  // 结束
  if (isOver) {
    var wonByUser = winner === "user";
    nodes.push(ctx.UI.Column({ spacing: 6, padding: { vertical: 8 } }, [
      ctx.UI.Text({ text: wonByUser ? "🎉 用户赢了！" : "😔 AI 获胜了", style: "headlineSmall", color: wonByUser ? primary : errorColor }),
      resultMsg ? ctx.UI.Text({ text: resultMsg, style: "bodyMedium", color: onSurface }) : null,
    ]));
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
  }

  // ⭐ 被打罚牌确认中间态：用户被打方需确认罚牌（+4 可质疑，+2 只确认；开启叠加时可接招同类罚牌反击）
  if (isUserPenalized) {
    var penKindLabel = pending.kind === "draw2" ? "+2" : "+4";
    var canChallenge = !!(pending.challengeAllowed && game && game.lastAction && game.lastAction.kind === "wild4" && game.lastAction.source === "ai");
    // 叠加：stacking 开启时扫描用户手牌里与罚牌同类型的 +2/+4 牌，供接招反击
    var stackingOn = !!(game && game.rules && game.rules.stacking);
    var stackable: any[] = [];
    if (stackingOn && myHand && myHand.length) {
      for (var si = 0; si < myHand.length; si++) {
        var sc = myHand[si];
        if (pending.kind === "draw2" && sc.value === "draw2") stackable.push(sc);
        else if (pending.kind === "wild4" && sc.value === "wild4") stackable.push(sc);
      }
    }
    // 展示预取的罚牌
    var revealCards: any[] = [];
    var drawAbles = pending.drawAbles || [];
    for (var ri = 0; ri < drawAbles.length; ri++) {
      var rc = drawAbles[ri];
      var rHex = _colorHex(rc.color);
      (function (card) {
        revealCards.push(ctx.UI.OutlinedCard({
          key: "rev_" + card.id,
          containerColor: _parseHex(rHex, 0.15),
          contentColor: _parseHex(rHex, 0.95),
          border: { width: 2, color: _parseHex(rHex, 0.9) },
          shape: { type: "rounded", cornerRadius: 8 },
          content: ctx.UI.Column({ spacing: 0, horizontalAlignment: "centerHorizontally", verticalArrangement: "center", width: 52, height: 70 }, [
            ctx.UI.Text({ text: _cardLabel(card), style: "titleSmall", color: _parseHex(rHex, 0.95), textAlign: "center" }),
          ]),
        }));
      })(rc);
    }
    // 叠加按钮（可能多张，用 LazyRow 横向滚动包裹，避免按钮过多撑爆）
    var stackBtn: any = null;
    if (stackable.length > 0) {
      var stackNodes: any[] = [];
      for (var bi = 0; bi < stackable.length; bi++) {
        (function (card) {
          var sHex = _colorHex(card.color);
          stackNodes.push(ctx.UI.Button({
            key: "stack_" + card.id,
            text: "使用 " + _cardLabel(card) + " 叠加",
            onClick: function () { stackReveal(card.id); },
            containerColor: _parseHex(sHex, 0.75),
          }));
        })(stackable[bi]);
      }
      stackBtn = ctx.UI.Column({ spacing: 6 }, [
        ctx.UI.Text({ text: "可接招反击（用同类" + penKindLabel + "把罚抽甩回" + (pending.source === "ai" ? "AI" : "用户") + "）：", style: "bodySmall", color: onSurfaceVariant }),
        ctx.UI.LazyRow({ spacing: 8, padding: { vertical: 4 } }, stackNodes),
      ]);
    }
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, [
      ctx.UI.Text({ text: "🎴 UNO 对战", style: "titleLarge", color: primary }),
      ctx.UI.Column({ spacing: 8, padding: { vertical: 8 } }, [
        ctx.UI.Text({ text: (pending.source === "ai" ? "AI" : "用户") + " 打出了" + penKindLabel + "，你被罚抽 " + pending.amount + " 张", style: "titleMedium", color: errorColor }),
        ctx.UI.Text({ text: "以下是你将抽到的牌（仅你可看）：", style: "bodySmall", color: onSurfaceVariant }),
      ]),
      ctx.UI.LazyRow({ spacing: 6, padding: { vertical: 6 } }, revealCards),
      stackBtn,
    renderAttachBox(),
    ctx.UI.Row({ spacing: 8, verticalAlignment: "centerVertically", padding: { vertical: 6 } }, [
      ctx.UI.Button({ text: "确认（抽 " + pending.amount + " 张）", onClick: confirmReveal, containerColor: primary }),
      canChallenge ? ctx.UI.Button({ text: "质疑（+4）", onClick: handleChallenge, containerColor: errorColor }) : ctx.UI.Spacer({}),
    ]),
      errorMsg ? ctx.UI.Text({ text: "⚠️ " + errorMsg, style: "bodySmall", color: errorColor }) : null,
    ]);
  }

  // ⭐ 万能牌选色中间态：单选一个颜色 + 点击"确认"才出牌（可取消返回，牌尚未打出）
  if (isPickingWild) {
    var wildCardLabel = "万能牌";
    var wildIds: any = wildPick && wildPick.ids;
    if (wildIds && wildIds.length) {
      var wf = myHand.find(function (h: any) { return h.id === wildIds[0]; });
      if (wf) wildCardLabel = _cardLabel(wf);
    }
    // 颜色选项（FilterChip 单选，选中高亮文字色）
    var wildColorOpts = [["red", "红"], ["blue", "蓝"], ["green", "绿"], ["yellow", "黄"]];
    var colorChips: any[] = [];
    for (var ci = 0; ci < wildColorOpts.length; ci++) {
      var colOpt = wildColorOpts[ci][0], labOpt = wildColorOpts[ci][1];
      var chipHex = _colorHex(colOpt);
      var isSel = wildColor === colOpt;
      (function (c, l, sel, hex) {
        colorChips.push(ctx.UI.FilterChip({
          key: "wildchip_" + c,
          selected: sel,
          onClick: function () { selectWildColor(c); },
          label: ctx.UI.Text({ text: l, style: "labelLarge", color: sel ? "#FFFFFF" : hex }),
        }));
      })(colOpt, labOpt, isSel, chipHex);
    }
    nodes.push(ctx.UI.Column({ spacing: 10, padding: { vertical: 8, horizontal: 12 } }, [
      ctx.UI.Text({ text: "出万能牌「" + wildCardLabel + "」，请选择生效颜色", style: "titleMedium", color: primary }),
      ctx.UI.Row({ spacing: 8, horizontalArrangement: "spaceBetween" }, colorChips),
      ctx.UI.Text({ text: "先选中一个颜色，再点「确认出牌」；也可取消返回重新选牌。", style: "bodySmall", color: onSurfaceVariant }),
      ctx.UI.Row({ spacing: 8, padding: { vertical: 6 } }, [
        ctx.UI.Button({ text: "确认出牌", onClick: confirmWildColor, containerColor: primary, enabled: !!wildColor }),
        ctx.UI.OutlinedButton({
          content: ctx.UI.Text({ text: "取消", style: "labelLarge", color: errorColor }),
          onClick: cancelWildPick,
          enabled: true,
        }),
      ]),
    ]));
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
  }

  // 抽牌中间态：展示抽到的牌 + 唯一"继续"按钮（明牌仅用户可见，不可取消）
  if (isAbandoning) {
    var dc = abandonDrawn ? _colorHex(abandonDrawn.color) : "#9E9E9E";
    var drawnNodes: any[] = [];
    if (abandonDrawn) {
      drawnNodes.push(ctx.UI.OutlinedCard({
        containerColor: _parseHex(dc, 0.15),
        contentColor: _parseHex(dc, 0.95),
        border: { width: 2, color: _parseHex(dc, 0.9) },
        shape: { type: "rounded", cornerRadius: 8 },
        content: ctx.UI.Column({ spacing: 0, horizontalAlignment: "centerHorizontally", verticalArrangement: "center", width: 60, height: 78 }, [
          ctx.UI.Text({ text: _cardLabel(abandonDrawn), style: "titleMedium", color: _parseHex(dc, 0.95), textAlign: "center" }),
        ]),
      }));
    }
    nodes.push(ctx.UI.Column({ spacing: 8, padding: { vertical: 8, horizontal: 12 } }, [
      ctx.UI.Text({ text: "你放弃出牌，抽到了这张牌", style: "titleMedium", color: primary }),
      ctx.UI.Row({ spacing: 8, verticalAlignment: "centerVertically" }, drawnNodes),
      ctx.UI.Text({ text: "这张牌只有你能看到。点击继续后通知 AI。", style: "bodySmall", color: onSurfaceVariant }),
      ctx.UI.Button({ text: "继续", onClick: continueAfterAbandon, containerColor: primary }),
    ]));
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
  }

  // 已出牌：出牌后优先展示（即使 currentTurn 已变）
  if (submitted) {
    nodes.push(ctx.UI.Column({ spacing: 4 }, [
      ctx.UI.Text({ text: "✅ 已出牌", style: "titleMedium", color: primary }),
      resultMsg ? ctx.UI.Text({ text: resultMsg, style: "bodyMedium", color: onSurface }) : null,
      ctx.UI.Text({ text: "本回合结束，等待 AI 出牌...", style: "bodySmall", color: onSurfaceVariant }),
    ]));
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
  }

  // 非用户回合
  if (!isUserTurn) {
    nodes.push(ctx.UI.Text({ text: "⏳ 等待 AI 出牌...", style: "bodyMedium", color: onSurfaceVariant }));
    return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
  }

  // 用户出牌区
  nodes.push(ctx.UI.Text({ text: "选择你要打出的卡牌（可同色/同数字多选）", style: "labelLarge", color: onSurface }));

  var handNodes: any[] = [];
  for (var i = 0; i < myHand.length; i++) {
    var c = myHand[i];
    var cc = _colorHex(c.color);
    var sel = !!chosen[c.id];
    (function (card) {
      handNodes.push(ctx.UI.FilterChip({
        key: "hand_" + card.id,
        selected: sel,
        onClick: function () { toggleChosen(card.id); },
        label: ctx.UI.Column({ spacing: 0, horizontalAlignment: "centerHorizontally" }, [
          ctx.UI.Text({ text: _cardLabel(card), style: "titleMedium", color: _parseHex(cc, 0.95) }),
        ]),
      }));
    })(c);
  }
  nodes.push(ctx.UI.LazyRow({ spacing: 6, padding: { vertical: 8 } }, handNodes));

  if (errorMsg) {
    nodes.push(ctx.UI.Text({ text: "⚠️ " + errorMsg, style: "bodySmall", color: errorColor }));
  }

nodes.push(renderAttachBox());
    nodes.push(ctx.UI.Row({ spacing: 8, padding: { vertical: 8 } }, [
      ctx.UI.Button({ text: "出牌", onClick: handlePlay, containerColor: primary, enabled: !!isUserTurn && !submitted }),
      ctx.UI.OutlinedButton({
        content: ctx.UI.Text({ text: "放弃本轮（抽1张）", style: "labelLarge", color: onSurface }),
        onClick: handleAbandon,
        enabled: !!isUserTurn && !submitted,
      }),
    ]));

  nodes.push(ctx.UI.Text({ text: "出牌后会自动结算并通知 AI 继续。", style: "labelSmall", color: onSurfaceVariant }));

  return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
}