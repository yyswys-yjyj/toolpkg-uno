"use strict";
// UNO 规则配置：基于环境变量存储（参考 questionnaire），带默认值兜底
// 规则通过 getEnv（main/ui）或 Tools.SoftwareSettings.readEnvironmentVariable（sandbox）读取，
// 缺失时使用默认官方规则，保证配置变化不影响对局逻辑（幂等解读）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_ENV_KEYS = void 0;
exports.defaultRules = defaultRules;
exports.readEnvFromSettingSoftwares = readEnvFromSettingSoftwares;
exports.readRulesAsync = readRulesAsync;
exports.rulesToDescription = rulesToDescription;
exports.RULE_ENV_KEYS = {
    singleOnly: "UNO_SINGLE_ONLY",
    stacking: "UNO_STACKING",
    requireUno: "UNO_REQUIRE_UNO",
};
// 默认（官方标准）规则
function defaultRules() {
    return {
        singleOnly: true,
        stacking: false,
        requireUno: true,
    };
}
// 手动读取环境变量（供 sandbox 上下文异步 Tools.SoftwareSettings 用）
async function readEnvFromSettingSoftwares() {
    const def = defaultRules();
    const g = globalThis;
    const out = { ...def };
    try {
        if (g.Tools && g.Tools.SoftwareSettings && typeof g.Tools.SoftwareSettings.readEnvironmentVariable === "function") {
            const single = await g.Tools.SoftwareSettings.readEnvironmentVariable(exports.RULE_ENV_KEYS.singleOnly);
            const stack = await g.Tools.SoftwareSettings.readEnvironmentVariable(exports.RULE_ENV_KEYS.stacking);
            const uno = await g.Tools.SoftwareSettings.readEnvironmentVariable(exports.RULE_ENV_KEYS.requireUno);
            const b = (raw, key) => {
                const v = raw && (raw.value !== undefined ? raw.value : raw);
                if (v !== undefined && v !== null) {
                    const s = String(v).toLowerCase();
                    if (s === "true" || s === "1" || s === "yes" || s === "on")
                        out[key] = true;
                    else if (s === "false" || s === "0" || s === "no" || s === "off")
                        out[key] = false;
                }
            };
            b(single, "singleOnly");
            b(stack, "stacking");
            b(uno, "requireUno");
        }
    }
    catch (e) { }
    return out;
}
// 统一读取规则：main/ui 用全局 getEnv（同步），sandbox 用 SoftwareSettings（异步）
async function readRulesAsync() {
    const def = defaultRules();
    const g = globalThis;
    if (typeof g.getEnv === "function") {
        const out = { ...def };
        const b = (key) => {
            let v = null;
            try {
                v = g.getEnv(exports.RULE_ENV_KEYS[key]);
            }
            catch (e) { }
            if (v !== undefined && v !== null) {
                const s = String(v).toLowerCase();
                if (s === "true" || s === "1" || s === "yes" || s === "on")
                    out[key] = true;
                else if (s === "false" || s === "0" || s === "no" || s === "off")
                    out[key] = false;
            }
        };
        b("singleOnly");
        b("stacking");
        b("requireUno");
        return out;
    }
    return await readEnvFromSettingSoftwares();
}
// 产出给 AI 的配置说明（GetConfig 用）
function rulesToDescription(rules) {
    const lines = [];
    lines.push("- 出牌方式：" + (rules.singleOnly ? "一次只能出一张（官方）" : "允许同色/同数字成组出牌"));
    lines.push("- +2/+4 叠加：" + (rules.stacking ? "允许叠加（变体：对手握有同类型+2/+4可接招累加）" : "不可叠加（官方：被罚即抽牌并跳过）"));
    lines.push("- 剩最后1张喊UNO：" + (rules.requireUno ? "是（官方）" : "否"));
    return lines.join("\n");
}
