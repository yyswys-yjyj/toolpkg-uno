/* METADATA
{
  "name": "uno",
  "display_name": {
    "zh": "UNO 工具",
    "en": "UNO Tools"
  },
  "description": {
    "zh": "在 Operit 中与 AI 对玩 UNO 卡牌游戏。提供游戏实例管理、出牌、查看手牌、弃牌抽牌等工具。状态由 JSON 全量控制，落盘在 cleanOnExit/uno 目录。\n\n━━━━━━ AI 使用手册：UNO XML 渲染标签 ━━━━━━\n当需要让用户（人类玩家）出牌时，务必在回复中输出一个 <uno> 标签：\n\n  ✓ JSON 写法：<uno>{\"gameId\":\"<游戏实例ID>\"}</uno>\n  ✓ 属性写法：<uno gameId=\"<游戏实例ID>\"/>\n\n示例：<uno>{\"gameId\":\"mygame1\"}</uno>\n\n━━━━━━【最重要】XML 格式硬性规范（违反则界面无法渲染、对局卡死） ━━━━━━\n1. 每当轮到用户出牌，你的回复【末尾】必须且只能输出一个 <uno> 标签，绝不可省略、不可停在等待而漏输出；每轮用户出牌前都重复输出一次。\n2. 仅允许上面两种写法（JSON 或属性），二选一，严格一字不差。<uno> 标签内必须是有效的游戏实例 ID。\n3. 严禁使用 Toolcall/工具调用式的自定义标签格式（如 <uno_gameId>、<uno 参数=...>、<uno_gameId=...>、</uno_xxx> 等任何变体），那些不会被系统识别成 UNO 界面，用户看不到手牌，对局会卡死。\n4. <uno> 标签必须放在你整条回复的最后，单独成段；前后不要粘贴其它无关的尖括号内容。\n5. 不要用其它工具或其它标签代替 <uno>；渲染 UNO 界面唯一入口就是 <uno> 标签。\n\n━━━━━━ 游戏状态存储 ━━━━━━\n- 游戏实例 JSON 保存在 cleanOnExit/uno/<gameId>.json（根为 /storage/emulated/0/Download/Operit/）\n\n━━━━━━ AI 对战流程（重要） ━━━━━━\n1. 用 start 新建游戏（可传 firstTurn=ai 或 user 指定先手，不传则随机）\n2. 若轮到 AI 出牌：用 list 查看自己的手牌 → 用 push 出牌（传入卡牌 id 数组），或 abd 弃牌抽牌\n3. AI 出牌后轮到用户：在回复末尾输出 <uno> 标签（内嵌 gameId）让用户操作\n4. 用户出牌/弃牌后会通过回调刷新 JSON，AI 继续用 list 看牌 → push/abd 出牌\n5. 任一方手牌清空即获胜：AI 获胜时工具返回会提示，用户获胜时界面显示结果\n\n━━━━━━ 出牌规则 ━━━━━━\n- 出的牌颜色须与当前生效色相同，或数字/动作与牌面相同\n- 万能牌(wild / wild4)随时可出；出 wild 时可用 push 的 color 参数指定生效色\n- push 的 cards 参数可同时传多张「同色」的牌一次性成组打出\n- +2 / +4 会令对方罚抽对应张数；skip 跳过对方回合\n\n━━━━━━ 手牌保密（重要） ━━━━━━\n- 你的手牌是隐藏信息！list 返回的 myHand 仅用于你内部决策，严禁把任何具体卡牌（颜色/数字/牌型/id）输出到回复文本、插入到 <uno> 标签、发送给用户或在对话中明牌。\n- 你只能通过 push / abd 工具操作手牌，绝不把 myHand 内容打印出来。\n\n注意：<uno> 标签只用于「让用户操作」时输出；AI 自己出牌一律用 push/abd 工具，不要输出 <uno>。",
    "en": "Play UNO card game with AI in Operit. Provides game instance management, playing cards, viewing hands, and drawing/abandoning tools. Full state is controlled by JSON stored in cleanOnExit/uno.\n\n━━━━━ AI MANUAL: UNO XML RENDER TAG ━━━━━\nWhen it's the user's (human player) turn, you MUST output a <uno> tag in your reply:\n\n  ✓ JSON form: <uno>{\"gameId\":\"<GameInstanceID>\"}</uno>\n  ✓ Attribute form: <uno gameId=\"<GameInstanceID>\"/>\n\nExample: <uno>{\"gameId\":\"mygame1\"}</uno>\n\n━━━━━【MOST IMPORTANT】XML FORMAT RULES (violating breaks UI, game stalls) ━━━━━\n1. Whenever it's the user's turn, your reply MUST end with exactly one <uno> tag; never omit it or stall waiting. Repeat it every turn the user must play.\n2. Only the two forms above (JSON or attribute) are allowed; pick one, exact. The <uno> tag must contain a valid game instance ID.\n3. NEVER use Toolcall-style custom tags (like <uno_gameId>, <uno param=...>, <uno_gameId=...>, </uno_xxx> or any variant); those won't be recognized as the UNO UI and the user won't see their hand.\n4. Place the <uno> tag at the very end of your reply, on its own line; don't paste other angle-bracket content around it.\n5. Don't use other tools or tags instead of <uno>; the only way to render the UNO UI is the <uno> tag.\n\n━━━━━ GAME STATE ━━━━━\n- Game JSON is saved at cleanOnExit/uno/<gameId>.json (root /storage/emulated/0/Download/Operit/)\n\n━━━━━ AI VS-WORKFLOW (important) ━━━━━\n1. Use start to create a game (firstTurn=ai or user to set who goes first; random if omitted)\n2. If it's the AI's turn: use list to view your hand → push to play (pass an array of card ids), or abd to draw/abandon\n3. After the AI plays and it's the user's turn: append a <uno> tag (with gameId) at the end of your reply\n4. After the user plays/abandons, state is refreshed via callback; the AI continues with list → push/abd\n5. The first side to empty their hand wins: tool returns flag when AI wins; the UI shows result when user wins\n\n━━━━━ PLAY RULES ━━━━━\n- A card must match the active color, or match the top card's value\n- Wild cards (wild/wild4) can always be played; when playing wild, use push's color param to set active color\n- push's cards param can take multiple same-color cards to play as one group\n- +2 / +4 force the opponent to draw that many; skip skips the opponent's turn\n\n━━━━━ HAND SECRECY (important) ━━━━━\n- Your hand is hidden info! myHand from list is only for your internal decision; never output any specific card (color/number/type/id) into your reply text, <uno> tag, to the user, or elsewhere.\n- You may only operate your hand via push / abd tools; never print myHand contents.\n\nNote: <uno> is ONLY for letting the user play; the AI itself must use push/abd tools, not <uno>."
  },
  "enabledByDefault": true,
  "category": "Game",
  "env": [
    {
      "name": "UNO_SINGLE_ONLY",
      "description": {
        "zh": "出牌方式：true=一次只能出一张(官方)；false=允许同色/同数字成组出牌",
        "en": "Play mode: true=one card at a time (official); false=allow grouped same-color/same-value plays"
      },
      "required": false
    },
    {
      "name": "UNO_STACKING",
      "description": {
        "zh": "+2/+4 叠加：true=允许对手接招反击累加罚抽(变体)；false=官方不叠加(被罚即抽牌并跳过)",
        "en": "Stacking: true=opponents can counter +2/+4 to accumulate penalty (variant); false=official no stacking"
      },
      "required": false
    },
    {
      "name": "UNO_REQUIRE_UNO",
      "description": {
        "zh": "剩最后1张时喊 UNO：true=是(官方)；false=否",
        "en": "Require UNO call when down to last card: true=yes (official); false=no"
      },
      "required": false
    }
  ],
  "tools": [
    {
      "name": "start",
      "description": {
        "zh": "开启一个新的 UNO 游戏实例。会生成随机牌组、分发 7 张手牌给 AI 和你(用户)，并随机决定先手。返回游戏状态与当前该谁出牌。",
        "en": "Start a new UNO game instance. Deals a random deck, 7 cards each to AI and user, and randomly decides who goes first. Returns game state and whose turn it is."
      },
      "parameters": [
        { "name": "gameId", "description": { "zh": "游戏实例 ID（唯一标识）", "en": "Game instance ID (unique)" }, "type": "string", "required": true },
        { "name": "firstTurn", "description": { "zh": "可选：指定先手（ai 或 user），不填则随机", "en": "Optional: specify first turn (ai or user); random if omitted" }, "type": "string", "required": false }
      ]
    },
    {
      "name": "push",
      "description": {
        "zh": "AI 出牌（打 AI 自己的手牌）。传入要打出的卡牌 id 数组。仅当当前轮到 AI 时可执行。自动结算牌效（+2/+4 罚抽、跳过、反转等）。该工具亦可用于叠加罚抽牌（+2/+4），仅在叠加开启的情况下生效。",
        "en": "Play the AI's own cards. Pass an array of card ids to play. Only valid on the AI's turn. Automatically resolves effects (+2/+4 draw penalty, skip, reverse, etc)."
      },
      "parameters": [
        { "name": "gameId", "description": { "zh": "游戏实例 ID", "en": "Game instance ID" }, "type": "string", "required": true },
        { "name": "cards", "description": { "zh": "要打出的卡牌 id 数组（可一次打出颜色或数字相同的成组牌）", "en": "Array of card ids to play (multiple allowed if same color or value)" }, "type": "array", "required": true },
        { "name": "color", "description": { "zh": "可选：当打出万能牌(wild)时指定生效颜色 red/blue/green/yellow", "en": "Optional: when playing a wild card, specify active color red/blue/green/yellow" }, "type": "string", "required": false }
      ]
    },
    {
      "name": "listgame",
      "description": {
        "zh": "浏览所有已创建的 UNO 游戏实例及其状态简况（双方手牌数、当前出牌方、牌面、是否有胜者）。",
        "en": "Browse all UNO game instances and their status summary (hand sizes, current turn, active card, winner)."
      },
      "parameters": []
    },
    {
      "name": "list",
      "description": {
        "zh": "获取当前游戏实例的完整信息：AI 自己的手牌、当前牌面、生效颜色、轮到谁出牌。用于 AI 决策下一步。",
        "en": "Get full info of a game instance: the AI's own hand, current active card, active color, and whose turn it is. For the AI to decide its next move."
      },
      "parameters": [
        { "name": "gameId", "description": { "zh": "游戏实例 ID", "en": "Game instance ID" }, "type": "string", "required": true }
      ]
    },
    {
      "name": "abd",
      "description": {
        "zh": "AI 放弃本轮出牌，从抽牌堆抽取 1 张（若抽到可出的牌会提示，可选择随后出牌）。仅当当前轮到 AI 时可用。",
        "en": "AI abandons this turn and draws 1 card from the draw pile (if the drawn card is playable, it is noted). Only valid on the AI's turn."
      },
      "parameters": [
        { "name": "gameId", "description": { "zh": "游戏实例 ID", "en": "Game instance ID" }, "type": "string", "required": true }
      ]
    },
    {
      "name": "stop",
      "description": {
        "zh": "终止（删除）一个 UNO 游戏实例。",
        "en": "Terminate (delete) a UNO game instance."
      },
      "parameters": [
        { "name": "gameId", "description": { "zh": "游戏实例 ID", "en": "Game instance ID" }, "type": "string", "required": true }
      ]
    },
    {
      "name": "guide",
      "description": {
        "zh": "请不要调用此工具。UNO 的界面由 AI 直接输出 <uno> 标签触发渲染，无需调用本工具。用法见上方子包描述中的「AI 使用手册」：当轮到用户出牌时，在回复中输出 <uno>{\"gameId\":\"<游戏实例ID>\"}</uno> 即可唤起 UNO 对战界面。",
        "en": "Do not call this tool. The UNO UI is triggered by the AI outputting a <uno> tag directly; no need to call this tool. See the AI manual in the subpackage description above: when it's the user's turn, output <uno>{\"gameId\":\"<GameInstanceID>\"}</uno> in your reply to open the UNO battle UI."
      },
      "parameters": []
    },
    {
      "name": "getconfig",
      "description": {
        "zh": "（在游戏开始前请务必通过 getconfig 阅读游戏规则设置）获取当前 UNO 规则配置（出牌方式/叠加/UNO判定），用于 AI 了解并按规则对局。",
        "en": "Get current UNO rule config (play mode/stacking/UNO rule) so AI can play accordingly."
      },
      "parameters": []
    },
    {
      "name": "challenge",
      "description": {
        "zh": "质疑（仅当对方刚出 +4 时可用）：怀疑对方违规出了 +4（对方手中有同色牌本不该出 +4）。质疑成立则对方自罚抽4，失败则该质疑者抽4。",
        "en": "Challenge (only when opponent just played +4): dispute an illegal wild4. If upheld, opponent draws 4; if failed, challenger draws 4."
      },
      "parameters": [
        { "name": "gameId", "description": { "zh": "游戏实例 ID", "en": "Game instance ID" }, "type": "string", "required": true }
      ]
    },
  {
    "name": "accept",
    "description": {
      "zh": "确认接受罚牌（对方刚出了 +2/+4，你被打罚抽）。确认后罚牌加入你手牌并跳过。accept 前可先 challenge（仅 +4）。",
      "en": "Accept the penalty cards (+2/+4) and draw them."
    },
    "parameters": [
      { "name": "gameId", "description": { "zh": "游戏实例 ID", "en": "Game instance ID" }, "type": "string", "required": true }
    ]
  }
  ]
}*/
var store = require("./store");
var game = require("./game");
var config = require("./config");

function colorLabel(c) {
  var m = { red: "红", blue: "蓝", green: "绿", yellow: "黄", wild: "万能" };
  return m[c] || c;
}

function snapshot(state) {
  var top = state.pile && state.pile.length > 0 ? state.pile[state.pile.length - 1] : null;
  return {
    gameId: state.gameId,
    success: true,
    currentTurn: state.currentTurn,
    activeColor: state.activeColor,
    colorLabel: colorLabel(state.activeColor),
    activeCard: top ? game.cardLabel(top) : null,
    myHand: state.players.ai,
    myHandCount: state.players.ai.length,
    userHandCount: state.players.user.length,
    winner: state.winner,
    deckCount: state.deck.length,
    rules: state.rules || config.defaultRules(),
    pendingPenalty: state.pendingPenalty || null
  };
}

async function start(params) {
  var gameId = String(params.gameId || "").trim();
  if (store.invalidGameId(gameId)) {
    return { success: false, message: "游戏实例 ID 非法（仅允许字母数字下划线，1~64字符）" };
  }
  var firstTurn;
  if (params.firstTurn === "ai" || params.firstTurn === "user") firstTurn = params.firstTurn;
  var curRules = await config.readRulesAsync();
  var res = await store.createGame(gameId, firstTurn, curRules);
  if (!res.ok || !res.state) return { success: false, message: res.message };
  var s = snapshot(res.state);
  s.message = "游戏已创建：" + gameId + "。先手：" + (res.state.currentTurn === "ai" ? "AI" : "用户");
  s.rulesText = config.rulesToDescription(res.state.rules || config.defaultRules());
  s.message += "\n规则：" + s.rulesText;
  s.firstTurn = res.state.firstTurn;
  s.lastHistory = res.state.history.slice(-3);
  if (res.state.currentTurn === "user") {
    s.message += "。现在轮到用户出牌，请发送 <uno> XML 让用户操作。";
  } else {
    s.message += "。当前是 AI 先手，AI 请先用 list 查看手牌并出牌。";
  }
  return s;
}

async function push(params) {
  var res = await store.loadGame(String(params.gameId || "").trim());
  if (!res) return { success: false, message: "游戏实例不存在: " + params.gameId };
  if (res.winner) return { success: false, message: "游戏已结束，胜者: " + (res.winner === "ai" ? "AI" : "用户"), winner: res.winner };
  if (res.currentTurn !== "ai") return { success: false, message: "当前不是 AI 的回合，请先让用户出牌" };

  var raw = params.cards;
  var ids = [];
  if (Array.isArray(raw)) ids = raw.map(function (x) { return String(x); });
  else if (typeof raw === "string") ids = raw.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  if (ids.length === 0) return { success: false, message: "请提供要打出的卡牌 id 数组" };

  var color = params.color;
  var chosenColor;
  if (color === "red" || color === "blue" || color === "green" || color === "yellow") chosenColor = color;

  var r = game.playCards(res, "ai", ids, chosenColor);
  if (!r.ok) return { success: false, message: r.message };

  if (r.won) {
    res.winnerAnnounced = true;
    await store.saveGame(res);
    var s = snapshot(res);
    s.result = true;
    s.aiWon = true;
    return { success: true, message: "AI 出牌完成，AI 手牌清空获胜！现在用户输了，请用 XML 向用户展示战败结果。", ...s };
  }

  await store.saveGame(res);
  var snap = snapshot(res);
  var tail;
  if (r.pendingReveal) {
    tail = "你出了罚牌，用户被打正待确认（可接招同类/认可/质疑）。请发送 <uno> XML 让用户处理罚牌。";
  } else if (r.pendingPenalty) {
    tail = "现在用户被罚待处理，请发送 <uno> XML 让用户接招、质疑或认罚。";
  } else {
    tail = "现在轮到用户出牌，请发送 <uno> XML 让用户操作。";
  }
  return { success: true, message: r.message + "。" + tail, ...snap };
}

async function listgame() {
  var ids = await store.listGameIds();
  var games = [];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var s = await store.loadGame(id);
    if (!s) continue;
    games.push({
      gameId: s.gameId,
      currentTurn: s.currentTurn,
      myHandCount: s.players.ai.length,
      userHandCount: s.players.user.length,
      activeCard: s.pile.length ? game.cardLabel(s.pile[s.pile.length - 1]) : null,
      winner: s.winner,
      created: s.created
    });
  }
  return { success: true, count: games.length, games: games };
}

async function list(params) {
  var res = await store.loadGame(String(params.gameId || "").trim());
  if (!res) return { success: false, message: "游戏实例不存在: " + params.gameId };
  return snapshot(res);
}

async function abd(params) {
  var res = await store.loadGame(String(params.gameId || "").trim());
  if (!res) return { success: false, message: "游戏实例不存在: " + params.gameId };
  if (res.winner) return { success: false, message: "游戏已结束", winner: res.winner };
  if (res.currentTurn !== "ai") return { success: false, message: "当前不是 AI 的回合，不能弃牌" };
  var r = game.abandonTurn(res, "ai");
  await store.saveGame(res);
  var s = snapshot(res);
  if (res.pendingPenalty) {
    s.message = r.message + "。现在轮到用户出牌，请发送 <uno> XML 让用户操作。";
  } else {
    s.message = r.message + "。现在轮到用户出牌，请发送 <uno> XML 让用户操作。";
  }
  return s;
}

async function getconfig() {
  var rules = await config.readRulesAsync();
  return { success: true, singleOnly: rules.singleOnly, stacking: rules.stacking, requireUno: rules.requireUno, description: config.rulesToDescription(rules) };
}

async function accept(params) {
  var res = await store.loadGame(String(params.gameId || "").trim());
  if (!res) return { success: false, message: "游戏实例不存在: " + params.gameId };
  if (res.winner) return { success: false, message: "游戏已结束", winner: res.winner };
  var r = game.acceptReveal(res, "ai");
  if (!r.ok) return { success: false, message: r.message };
  await store.saveGame(res);
  return { success: true, message: r.message, ...snapshot(res) };
}

async function challenge(params) {
  var res = await store.loadGame(String(params.gameId || "").trim());
  if (!res) return { success: false, message: "游戏实例不存在: " + params.gameId };
  if (res.winner) return { success: false, message: "游戏已结束", winner: res.winner };
  var r = game.challengeWild4(res, "ai");
  if (!r.ok) return { success: false, message: r.message };
  await store.saveGame(res);
  return { success: true, message: r.message, ...snapshot(res) };
}

async function stop(params) {
  var gameId = String(params.gameId || "").trim();
  var ok = await store.deleteGame(gameId);
  return ok
    ? { success: true, message: "游戏实例已终止: " + gameId }
    : { success: false, message: "终止失败或实例不存在: " + gameId };
}

function wrap(func) {
  return async function (params) {
    try {
      return await func(params);
    } catch (e) {
      return { success: false, message: "UNO 工具执行失败: " + (e && e.message ? e.message : String(e)) };
    }
  };
}

exports.start = wrap(start);
exports.push = wrap(push);
exports.listgame = wrap(listgame);
exports.list = wrap(list);
exports.abd = wrap(abd);
exports.stop = wrap(stop);
exports.getconfig = wrap(getconfig);
exports.challenge = wrap(challenge);
exports.accept = wrap(accept);
exports.guide = wrap(async function () {
  return { success: false, message: "无需调用此工具，直接输出 <uno> 标签触发界面" };
});