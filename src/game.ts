// UNO 游戏核心逻辑（纯逻辑，无宿主依赖，可在 main / 工具 / UI 中复用）
// ts 定义：状态全部由 JSON 控制，落盘到 /storage/emulated/0/Download/Operit/cleanOnExit/uno

export const GAME_DIR = "/storage/emulated/0/Download/Operit/cleanOnExit/uno";

export type Color = "red" | "blue" | "green" | "yellow";
export type CardValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw2"
  | "wild" | "wild4";

export interface Card {
  color: Color | "wild";
  value: CardValue;
  id: string;
}

// 玩家：user（人类）、ai（AI 陪玩）
export interface PlayerHand {
  cards: Card[];
}

// 规则配置（创建时快照进 json）
export interface UnoRules {
  singleOnly: boolean;   // true=一次一张(官方) false=允许成组
  stacking: boolean;     // true=+2/+4可叠(变体) false=官方不叠
  requireUno: boolean;   // true=剩1张喊UNO false=不喊
}

// 待处理罚牌状态（stacking 触发后记录）
export interface PendingPenalty {
  amount: number;          // 累计罚抽数
  kind: "draw2" | "wild4"; // 罚牌类型（+2/+4 隔离）
  target: "ai" | "user";   // 当前该谁接招/认罚（被打方）
  source: "ai" | "user";   // 最后打出罚牌的人
}

// 待确认罚牌展示（+2/+4 出牌后：预取牌，被打方确认后才真罚；+4 可被质疑）
export interface PendingReveal {
  kind: "draw2" | "wild4";
  target: "ai" | "user";   // 被打方
  source: "ai" | "user";   // 出牌者
  amount: number;          // 应罚抽张数（2 或 4）
  drawAbles: Card[];       // 预取的牌（确认后才加入被打方手牌）
  challengeAllowed: boolean; // +2=false(不可质疑) +4=true(可质疑)
}

// 上一步动作快照（用于质疑 +4 判定）
export interface LastAction {
  kind: "none" | "wild4" | "other";
  prevActiveColor: Color;  // 打出牌前的生效色
  source: "ai" | "user";   // 出牌者
  hadMatch: boolean;       // 出牌者打 wild4 后剩余手牌是否含 prevActiveColor 同色（有=.违规）
}

export function defaultRules(): UnoRules {
  return { singleOnly: true, stacking: false, requireUno: true };
}

export interface UnoGameState {
  gameId: string;
  created: number;
  updated: number;
  deck: Card[]; // 抽牌堆（剩余）
  pile: Card[]; // 弃牌堆顶在最后
  players: {
    ai: Card[];
    user: Card[];
  };
  currentTurn: "ai" | "user"; // 当前出牌的是谁
  firstTurn: "ai" | "user"; // 开局先手
  direction: 1 | -1; // 1 顺时针 / -1 逆时针（双人其实无所谓）
  activeColor: Color; // 当前生效颜色（wild 后指定）
  winner: "ai" | "user" | null;
  winnerAnnounced: boolean;
  history: string[]; // 简单日志
  rules?: UnoRules;         // 创建时快照的规则（后续流程只从这读）
  pendingPenalty?: PendingPenalty | null; // stacking 待罚状态
  pendingReveal?: PendingReveal | null;   // +2/+4 待确认罚牌展示（预取牌，确认后才真罚）
  lastAction?: LastAction;  // 上一步动作快照（供质疑）
}

// ---------- 基础工具 ----------
function makeDeck(): Card[] {
  const colors: Color[] = ["red", "blue", "green", "yellow"];
  const numeric: CardValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const action: CardValue[] = ["skip", "reverse", "draw2"];
  const deck: Card[] = [];
  let seq = 0;
  for (const c of colors) {
    for (const v of numeric) {
      deck.push({ color: c, value: v, id: "c" + seq++ });
      if (v !== "0") deck.push({ color: c, value: v, id: "c" + seq++ });
    }
    for (const v of action) {
      deck.push({ color: c, value: v, id: "c" + seq++ });
      deck.push({ color: c, value: v, id: "c" + seq++ });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ color: "wild", value: "wild", id: "c" + seq++ });
  for (let i = 0; i < 4; i++) deck.push({ color: "wild", value: "wild4", id: "c" + seq++ });
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- 新建游戏 ----------
export function newGameState(gameId: string, firstTurn?: "ai" | "user", rules?: UnoRules): UnoGameState {
  let deck = shuffle(makeDeck());
  // 打出首张非 wild 牌，避免开局颜色为 wild 出问题
  let starter: Card | null = null;
  let starterIdx = -1;
  for (let i = 0; i < deck.length; i++) {
    if (deck[i].color !== "wild") { starter = deck[i]; starterIdx = i; break; }
  }
  if (!starter) throw new Error("无法初始化牌堆");
  deck.splice(starterIdx, 1);

  const aiCards: Card[] = [];
  const userCards: Card[] = [];
  for (let i = 0; i < 7; i++) { aiCards.push(deck.pop()!); userCards.push(deck.pop()!); }

  let ft = firstTurn;
  if (!ft) ft = Math.random() < 0.5 ? "ai" : "user";

  return {
    gameId,
    created: Date.now(),
    updated: Date.now(),
    deck,
    pile: [starter],
    players: { ai: aiCards, user: userCards },
    currentTurn: ft,
    firstTurn: ft,
    direction: 1,
    activeColor: starter.color as Color,
    winner: null,
    winnerAnnounced: false,
    history: ["游戏开始，首张牌为 " + cardLabel(starter) + "，先手：" + (ft === "ai" ? "AI" : "用户")],
    rules: rules ? { ...rules } : defaultRules(),  // 创建时快照规则，后续只从这读
    pendingPenalty: null,
    pendingReveal: null,
    lastAction: { kind: "none", prevActiveColor: starter.color as Color, source: "user", hadMatch: false },
  };
}

// ---------- 描述 ----------
export function cardLabel(c: Card): string {
  const colorMap: Record<string, string> = {
    red: "红", blue: "蓝", green: "绿", yellow: "黄", wild: "万能",
  };
  const valueMap: Record<string, string> = {
    skip: "跳过", reverse: "反转", draw2: "+2", wild: "换色", wild4: "+4",
  };
  const color = c.color === "wild" ? (c.value === "wild4" ? "" : "") : colorMap[c.color];
  const v = valueMap[c.value] || c.value;
  if (c.value === "wild" || c.value === "wild4") return "万能牌 " + v;
  return color + " " + v;
}

// 判断某张牌能否打出
export function canPlay(c: Card, activeColor: Color, top: Card): boolean {
  if (c.color === "wild") return true; // wild / wild4 总能出
  if (c.color === activeColor) return true;
  if (c.value === top.value) return true; // 数字或动作牌同名可叠
  return false;
}

// ---------- 抽牌 ----------
function draw(state: UnoGameState, who: "ai" | "user"): Card | null {
  let card: Card | undefined;
  if (state.deck.length === 0) {
    // 弃牌堆除顶牌外重新洗入抽牌堆
    if (state.pile.length <= 1) return null;
    const top = state.pile.pop()!;
    const reshuffle = shuffle(state.pile);
    state.pile = [top];
    state.deck = reshuffle;
    state.history.push("抽牌堆耗尽，弃牌堆重新洗牌");
  }
  card = state.deck.pop();
  if (!card) return null;
  state.players[who].push(card);
  return card;
}

// 预取 n 张牌（从 deck，必要时重洗 pile），返回并从 deck 移除，未加入任何手牌
function peekDrawN(state: UnoGameState, n: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      if (state.pile.length <= 1) break;
      const t = state.pile.pop()!;
      const reshuffle = shuffle(state.pile);
      state.pile = [t];
      state.deck = reshuffle;
      state.history.push("抽牌堆耗尽，弃牌堆重新洗牌");
    }
    const c = state.deck.pop();
    if (c) out.push(c);
  }
  return out;
}

// 简化：双人把 "回合推进" 抽象成 一方出牌后轮到另一方。
// direction 保留字段，不影响双人顺序。

// ---------- 通用出牌（who 指定玩家） ----------
export function playCards(state: UnoGameState, who: "ai" | "user", cardIds: string[], chosenColor?: Color): { ok: boolean; message: string; won: boolean; pendingPenalty?: boolean; pendingReveal?: boolean } {
  const top = state.pile[state.pile.length - 1];
  const hand = state.players[who];
  const opponent: "ai" | "user" = who === "ai" ? "user" : "ai";
  const rules = state.rules || defaultRules();

  if (!cardIds || cardIds.length === 0) {
    return { ok: false, message: "未选择任何卡牌", won: false };
  }

  const cardsToPlay: Card[] = [];
  const seen = new Set<string>();
  for (const id of cardIds) {
    const c = hand.find((h) => h.id === id);
    if (!c) return { ok: false, message: "卡牌不存在: " + id, won: false };
    if (seen.has(id)) return { ok: false, message: "重复选择卡牌: " + id, won: false };
    seen.add(id);
    cardsToPlay.push({ ...c });
  }

  // ⚠️ pendingReveal 拦截：存在待确认罚牌时，只能先确认（+2）或确认/质疑（+4）或「接招叠加」，不能随意出牌
  const rev = state.pendingReveal;
  if (rev) {
    if (rev.target !== who) {
      return { ok: false, message: rev.target === "user" ? "等待用户确认罚牌" : "等待 AI 确认罚牌", won: false };
    }
    // who 是待确认方（被打方）：
    // 开启 stacking 且本次出的是「与罚牌同类型」→ 放行让下方接招累加处理；否则拦截要求先确认
    const stk = !!(state.rules && state.rules.stacking);
    const firstCard = cardsToPlay[0];
    const sameKindPenalty = rev.kind === "draw2"
      ? firstCard && firstCard.value === "draw2"
      : firstCard && firstCard.value === "wild4";
    if (!(stk && sameKindPenalty)) {
      return { ok: false, message: rev.challengeAllowed ? "正被罚 +4，可接招同类 +4 反击，或确认/质疑" : "正被罚 +2，可接招同类 +2 反击，或确认罚牌", won: false };
    }
  }

  // singleOnly：官方规则只能单张；false 才允许同色/同数字成组
  if (rules.singleOnly) {
    if (cardsToPlay.length > 1) {
      return { ok: false, message: "官方规则：一次只能打出一张牌", won: false };
    }
  } else {
    if (cardsToPlay.length > 1) {
      const fc = cardsToPlay[0].color, fv = cardsToPlay[0].value;
      for (const c of cardsToPlay.slice(1)) {
        if (c.color !== fc && c.value !== fv) {
          return { ok: false, message: "一次只能打出颜色或数字相同的成组牌", won: false };
        }
      }
      // 功能牌类型隔离：组内不能同时包含 +2 和 +4（+2 只能成组 +2，+4 只能成组 +4）
      let hasD2 = false, hasW4 = false;
      for (const c of cardsToPlay) {
        if (c.value === "draw2") hasD2 = true;
        else if (c.value === "wild4") hasW4 = true;
      }
      if (hasD2 && hasW4) {
        return { ok: false, message: "功能牌无法混组：+2 与 +4 不能同时成组打出", won: false };
      }
    }
  }

  const baseCard = cardsToPlay[0];
  if (!canPlay(baseCard, state.activeColor, top)) {
    return { ok: false, message: "所选卡牌不符合当前牌面，无法打出", won: false };
  }

  const prevActiveColor = state.activeColor; // 快照（质疑需用出牌前颜色）
  const idSet = new Set(cardIds);
  state.players[who] = hand.filter((h) => !idSet.has(h.id));
  for (const c of cardsToPlay) state.pile.push(c);
  const played = cardsToPlay[0];
  let msg = (who === "ai" ? "AI 出牌：" : "用户出牌：") + cardsToPlay.map(cardLabel).join("、");

  let extra = 0;
  let skipOpponent = false; // 对方是否被跳过（罚牌/skip 叠加；reverse 奇偶抵消）
  let isPenaltyKind = false; // 组内含 +2/+4
  let hasWild4 = false;      // 组内含 +4（质疑判定用）
  let skipCount = 0;         // 组内 skip 张数（始终叠加）
  let reverseCount = 0;      // 组内 reverse 张数（双人局：奇数生效、偶数抵消）
  let reverseBlocked = false; // 标记本次有 reverse 因抵消而不跳过
  // 成组出牌：效果叠加法——统计各效果后按规则判定回合
  for (const c of cardsToPlay) {
    if (c.value === "draw2") { extra += 2; skipOpponent = true; isPenaltyKind = true; }
    else if (c.value === "wild4") { extra += 4; skipOpponent = true; isPenaltyKind = true; hasWild4 = true; }
    else if (c.value === "skip") { skipCount++; }
    else if (c.value === "reverse") { reverseCount++; }
  }
  // reverse 奇偶抵消：偶数张 reverse 互相抵消（本轮不跳过）；奇数张才生效
  if (reverseCount % 2 === 1) skipOpponent = true;
  else if (reverseCount > 0) reverseBlocked = true;
  if (skipCount > 0) skipOpponent = true;
  let penaltyCount = 0; // 组内罚牌张数（用于消息文案）
  for (const c of cardsToPlay) { if (c.value === "draw2" || c.value === "wild4") penaltyCount++; }

  // 记录 lastAction（质疑用）
  const origLast: LastAction = { kind: "none", prevActiveColor, source: who, hadMatch: false };
  // 出 wild4 后，检查出牌者剩余手牌是否含前生效色（质疑判定依据）
  if (hasWild4) {
    const hasMatch = state.players[who].some((c) => c.color === prevActiveColor);
    origLast.kind = "wild4";
    origLast.hadMatch = hasMatch;
  } else {
    origLast.kind = played.color === "wild" ? "other" : "other";
  }
  state.lastAction = origLast;

  // 决定生效颜色
  if (played.color === "wild") {
    let best: Color;
    if (chosenColor && ["red", "blue", "green", "yellow"].indexOf(chosenColor) >= 0) {
      best = chosenColor;
    } else {
      const counts: Record<Color, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
      for (const c of state.players[who]) if (c.color !== "wild") counts[c.color as Color]++;
      let bk: Color = "red"; let bn = -1;
      for (const c of Object.keys(counts) as Color[]) { if (counts[c] > bn) { bn = counts[c]; bk = c; } }
      best = bk;
      if (bn <= 0) best = state.activeColor || "red";
    }
    state.activeColor = best;
    msg += "，指定" + colorText(best) + "色";
  } else {
    state.activeColor = played.color;
  }

  // 成组出牌效果叠加：extra 已在上面累加；此处拼接叠加文案
  if (isPenaltyKind) {
    msg += "，" + (opponent === "user" ? "用户" : "AI") + " 被罚抽 " + extra + " 张";
    if (penaltyCount > 1) msg += "（" + penaltyCount + " 张罚牌叠加）";
  }
  // 跳过/反转（当对方被跳过）
  if (skipOpponent) {
    msg += "，跳过" + (opponent === "user" ? "用户" : "AI") + "回合";
  } else if (reverseBlocked) {
    // 反转偶数张互相抵消：方向回到原点 = 正常轮到对方
    msg += "，反转抵消（方向回到原位）";
  }

  // ⭐ +2/+4 → 预取牌进 pendingReveal（暂不真罚，被打方确认才执法；+4 可质疑）
  // 若存在既有 pendingReveal 且本次是同类型罚牌（stacking 接招），累加预取
  const kindForReveal: "draw2" | "wild4" = hasWild4 ? "wild4" : "draw2";
  const existingRev = state.pendingReveal;
  if (isPenaltyKind) {
    // 预取应罚张数
    const drew = peekDrawN(state, extra);
    if (existingRev && existingRev.kind === kindForReveal && existingRev.target === who) {
      // 接招：累加预取 + 目标切换，保留原已展示的牌（新预取追加）
      state.pendingReveal = {
        kind: kindForReveal,
        target: opponent,
        source: who,
        amount: existingRev.amount + extra,
        drawAbles: existingRev.drawAbles.concat(drew),
        challengeAllowed: kindForReveal === "wild4",
      };
      const newMsg = (who === "ai" ? "AI" : "用户") + " 接招反击！罚抽累加至 " + state.pendingReveal.amount + " 张，" + (opponent === "user" ? "用户" : "AI") + " 需查看并确认。";
      state.currentTurn = opponent;
      state.history.push(newMsg);
      state.updated = Date.now();
      return { ok: true, message: newMsg, won: false, pendingReveal: true };
    }
    // 首次打罚牌：进 pendingReveal，等被打方确认
    state.pendingReveal = {
      kind: kindForReveal, target: opponent, source: who,
      amount: extra, drawAbles: drew,
      challengeAllowed: kindForReveal === "wild4",
    };
    state.history.push(msg);
    state.currentTurn = opponent; // 被打方需确认
    state.updated = Date.now();
    return { ok: true, message: msg, won: false, pendingReveal: true };
  }

  state.pendingReveal = null;

  state.history.push(msg);
  state.updated = Date.now();

  if (state.players[who].length === 0) {
    state.winner = who;
    state.history.push("🎉 " + (who === "ai" ? "AI" : "用户") + " 手牌清空，获胜！");
    return { ok: true, message: msg, won: true };
  }
  // 标准：skip/reverse/+2/+4 让对方被跳过（双人局连出）；普通牌才轮到对方
  state.currentTurn = skipOpponent ? who : opponent;
  return { ok: true, message: msg, won: false };
}

// ---------- 质疑 +4（challenge） ----------
// 用户/AI 在被打 +4 时可质疑对方违规出 +4。仅当上一步是对方出 wild4 且存在待罚/可质疑时机。
// 返回 { ok, message }
export function challengeWild4(state: UnoGameState, challenger: "ai" | "user"): { ok: boolean; message: string; penaltyDraw: number } {
  const la = state.lastAction;
  if (!la || la.kind !== "wild4") {
    return { ok: false, message: "当前无可质疑的上一步（仅当对方刚出 +4 时可质疑）", penaltyDraw: 0 };
  }
  if (la.source === challenger) {
    return { ok: false, message: "不能质疑自己出的牌", penaltyDraw: 0 };
  }
  const opponent: "ai" | "user" = challenger === "ai" ? "user" : "ai"; // 出牌者
  // 判定
  if (la.hadMatch) {
    // 质疑成立：收回 +4 → 还原牌面（顶牌/生效色回到出+4前）→ 出牌者违规罚抽4
    const topCard = state.pile[state.pile.length - 1];
    if (topCard && topCard.value === "wild4") {
      state.pile.pop();                          // 收回 +4
      state.players[opponent].push(topCard);     // 退回出牌者手牌
    }
    state.activeColor = la.prevActiveColor;      // 生效色还原到出+4前
    for (let i = 0; i < 4; i++) draw(state, opponent); // 违规者自罚4
    state.pendingReveal = null;
    state.lastAction = { kind: "none", prevActiveColor: state.activeColor, source: challenger, hadMatch: false };
    const msg = (challenger === "ai" ? "AI" : "用户") + " 质疑成功！" + (opponent === "ai" ? "AI" : "用户") + " 违规出 +4，收回并还原牌面，" + (opponent === "ai" ? "AI" : "用户") + " 自罚抽 4 张。";
    state.history.push(msg);
    state.currentTurn = challenger;
    state.updated = Date.now();
    return { ok: true, message: msg, penaltyDraw: 0 };
  } else {
    // 质疑失败：challenger 保留预取的 4 张 + 再罚抽 2 张 = 共 6 张
    const preAll = (state.pendingReveal && state.pendingReveal.drawAbles) || [];
    for (const c of preAll) state.players[challenger].push(c); // 原预取4张加入
    for (let i = 0; i < 2; i++) draw(state, challenger);        // 再罚2张
    state.pendingReveal = null;
    state.lastAction = { kind: "none", prevActiveColor: state.activeColor, source: challenger, hadMatch: false };
    const msg = (challenger === "ai" ? "AI" : "用户") + " 质疑失败（对方确实无同色牌），" + (challenger === "ai" ? "AI" : "用户") + " 罚抽 6 张（原4张 + 额外2张）。";
    state.history.push(msg);
    state.currentTurn = opponent;
    state.updated = Date.now();
    return { ok: true, message: msg, penaltyDraw: 6 };
  }
}

// ---------- 确认罚牌（+2/+4） ----------
// 被打方确认（或 AI accept）：把预取的牌正式加入被打方手牌，清空 pendingReveal，轮到出罚牌者连出。
export function acceptReveal(state: UnoGameState, who: "ai" | "user"): { ok: boolean; message: string } {
  const rev = state.pendingReveal;
  if (!rev) return { ok: false, message: "当前没有待确认的罚牌", ...({} as any) };
  if (rev.target !== who) {
    return { ok: false as boolean, message: "当前不是 " + (who === "ai" ? "AI" : "用户") + " 确认罚牌", ...({} as any) } as any;
  }
  const drawn = rev.drawAbles || [];
  for (const c of drawn) state.players[who].push(c);
  state.pendingReveal = null;
  state.lastAction = { kind: "none", prevActiveColor: state.activeColor, source: who, hadMatch: false };
  const msg = (who === "ai" ? "AI" : "用户") + " 确认罚牌，抽 " + drawn.length + " 张并被跳过。";
  state.history.push(msg);
  state.currentTurn = rev.source; // 轮到原出罚牌者连出
  state.updated = Date.now();
  return { ok: true, message: msg };
}

// ---------- 通用弃牌/抽牌（who 指定玩家） ----------
export function abandonTurn(state: UnoGameState, who: "ai" | "user"): { ok: boolean; message: string } {
  const top = state.pile[state.pile.length - 1];
  const opponent: "ai" | "user" = who === "ai" ? "user" : "ai";
  const whoName = who === "ai" ? "AI" : "用户";
  // 若存在待确认罚牌且当前玩家是待确认方：等同确认罚牌
  const revPending = state.pendingReveal;
  if (revPending && revPending.target === who) {
    return acceptReveal(state, who);
  }

  // 正常弃牌：抽 1 张
  const drawn = draw(state, who);
  let msg = whoName + " 放弃出牌，抽了 1 张";
  if (drawn && canPlay(drawn, state.activeColor, top)) {
    msg += "（抽到可出的牌：" + cardLabel(drawn) + "，可以选择打出）";
  }
  state.history.push(msg);
  state.currentTurn = opponent;
  state.updated = Date.now();
  return { ok: true, message: msg };
}

function colorText(c: string): string {
  const m: Record<string, string> = { red: "红", blue: "蓝", green: "绿", yellow: "黄" };
  return m[c] || c;
}
