"use strict";
// @ts-nocheck
// UNO 规则设置 UI（工具箱）：用环境变量存储规则（参考 questionnaire）
// 规则读取用 getEnv，保存用 Tools.SoftwareSettings.writeEnvironmentVariable
// 版本检查 + 更新历程：同一信息源同时拉取（复用 questionnaire 的 Card 布局 + Markdown 渲染）
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;
function _readBool(key, def) {
    if (typeof getEnv !== "function")
        return def;
    try {
        var v = getEnv(key);
        if (v === "true" || v === "1" || v === "yes")
            return true;
        if (v === "false" || v === "0" || v === "no")
            return false;
    }
    catch (e) { }
    return def;
}
// 版本号格式化：三位数字 → x.y.z
function _fmtVer(n) {
    var s = String(n);
    if (s.length === 3)
        return s.charAt(0) + "." + s.charAt(1) + "." + s.charAt(2);
    if (s.length === 2)
        return "0." + s.charAt(0) + "." + s.charAt(1);
    return s;
}
function Screen(ctx) {
    var primary = ctx.MaterialTheme.colorScheme.primary;
    var onSurface = ctx.MaterialTheme.colorScheme.onSurface;
    var onSurfaceVariant = ctx.MaterialTheme.colorScheme.onSurfaceVariant;
    var surfaceVariant = ctx.MaterialTheme.colorScheme.surfaceVariant;
    var onPrimary = ctx.MaterialTheme.colorScheme.onPrimary;
    var singleOnlyState = ctx.useState("_single", _readBool("UNO_SINGLE_ONLY", true));
    var stackingState = ctx.useState("_stacking", _readBool("UNO_STACKING", false));
    var requireUnoState = ctx.useState("_requireUno", _readBool("UNO_REQUIRE_UNO", true));
    var savedState = ctx.useState("_saved", false);
    // ===== 版本检查 / 更新历程（同一信息源同时拉取） =====
    var _PLUGIN_VER = 102; // 当前版本（三位数字）
    var _infoUrls = [
        "https://raw.githubusercontent.com/yyswys-yjyj/toolpkg-uno/refs/heads/main/api/info.json",
        "https://cdn.jsdelivr.net/gh/yyswys-yjyj/toolpkg-uno@main/api/info.json",
        "https://git.repo.archive.serveryyswys.top/yyswys-yjyj/toolpkg-uno/raw/branch/main/api/info.json",
        "https://cdn.serveryyswys.top/cdn/github/yyswys-yjyj/toolpkg-uno/refs/heads/main/api/info.json",
    ];
    var _infoLabels = ["GitHub", "jsDelivr", "作者服务器", "作者服务器(反代)"];
    var infoSourceState = ctx.useState("_infoSource", 0);
    var infoStatusState = ctx.useState("_infoStatus", "idle"); // idle / loading / done
    var versionInfoState = ctx.useState("_versionInfo", "");
    var changelogContentState = ctx.useState("_changelogContent", "");
    var singleOnly = singleOnlyState[0];
    var stacking = stackingState[0];
    var requireUno = requireUnoState[0];
    var saved = savedState[0];
    var infoStatus = infoStatusState[0];
    var versionInfo = versionInfoState[0];
    var changelogContent = changelogContentState[0];
    function saveRules() {
        try {
            Tools.SoftwareSettings.writeEnvironmentVariable("UNO_SINGLE_ONLY", String(singleOnly));
            Tools.SoftwareSettings.writeEnvironmentVariable("UNO_STACKING", String(stacking));
            Tools.SoftwareSettings.writeEnvironmentVariable("UNO_REQUIRE_UNO", String(requireUno));
            savedState[1](true);
            try {
                ctx.showToast("✓ 规则已保存（影响之后新开的对局）");
            }
            catch (e) { }
        }
        catch (e) {
            try {
                ctx.showToast("保存失败：" + String(e));
            }
            catch (e2) { }
        }
    }
    async function fetchInfo(srcIdx) {
        var url = _infoUrls[srcIdx];
        try {
            var res = await ctx.callTool("http_request", { url: url, method: "GET" });
            var content = res && res.content ? String(res.content).trim() : "";
            if (!content)
                return null;
            return JSON.parse(content);
        }
        catch (e) {
            return null;
        }
    }
    // 一键检查：同一信息源同时拉取版本 + 更新历程
    async function fetchPluginInfo() {
        if (infoStatus === "loading")
            return;
        infoStatusState[1]("loading");
        versionInfoState[1]("");
        changelogContentState[1]("");
        var si = infoSourceState[0];
        if (si < 0 || si >= _infoUrls.length) {
            si = 0;
        }
        var info = await fetchInfo(si);
        // ---- 版本 ----
        if (!info || info.latest === undefined) {
            versionInfoState[1]("检查失败：" + _infoLabels[si] + "不可用");
            var ch = changelogContentState[0];
            infoStatusState[1]("done");
            return;
        }
        var latest = Number(info.latest);
        if (latest === _PLUGIN_VER) {
            versionInfoState[1]("✓ 已是最新版 v" + _fmtVer(_PLUGIN_VER) + "（" + _infoLabels[si] + "）");
        }
        else if (latest > _PLUGIN_VER) {
            versionInfoState[1]("⚠ 发现新版本 v" + _fmtVer(latest) + "（当前 v" + _fmtVer(_PLUGIN_VER) + "，" + _infoLabels[si] + "）");
        }
        else {
            versionInfoState[1]("当前版本 v" + _fmtVer(_PLUGIN_VER) + " 高于远端 v" + _fmtVer(latest) + "（本地为开发版）");
        }
        // ---- 更新历程（拼成 markdown 交给 renderChangelogText 渲染） ----
        if (info.changelog && Array.isArray(info.changelog) && info.changelog.length > 0) {
            var blocks = [];
            for (var i = 0; i < info.changelog.length; i++) {
                var entry = info.changelog[i];
                var verTxt = entry.version !== undefined ? "v" + _fmtVer(Number(entry.version)) : "未知版本";
                var mark = Number(entry.version) === _PLUGIN_VER ? "（当前版本）" : "";
                if (i > 0)
                    blocks.push("---");
                blocks.push("# " + mark + " " + verTxt);
                if (entry.details)
                    blocks.push(String(entry.details));
            }
            changelogContentState[1](blocks.join("\n\n"));
        }
        else {
            changelogContentState[1]("无更新历程数据");
        }
        infoStatusState[1]("done");
    }
    // Markdown 渲染（复用 questionnaire 逻辑）：标题分级 / --- 分隔 / - 列表 / 空行
    function renderChangelogText(md) {
        if (!md)
            return null;
        var paragraphs = md.split("\n");
        var nodes = [];
        for (var pi = 0; pi < paragraphs.length; pi++) {
            var line = paragraphs[pi];
            var trimmed = line.trim();
            if (trimmed.length === 0) {
                nodes.push(ctx.UI.Spacer({ height: 8 }));
            }
            else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
                nodes.push(ctx.UI.Divider({ thickness: 0.5, color: onSurfaceVariant, padding: { vertical: 4 } }));
            }
            else if (trimmed.indexOf("# ") === 0) {
                nodes.push(ctx.UI.Text({ text: trimmed.substring(2), style: "titleSmall", color: primary, padding: { top: 8 } }));
            }
            else if (trimmed.indexOf("## ") === 0) {
                nodes.push(ctx.UI.Text({ text: trimmed.substring(3), style: "titleSmall", color: primary, padding: { top: 4 } }));
            }
            else if (trimmed.indexOf("#### ") === 0) {
                nodes.push(ctx.UI.Text({ text: trimmed.substring(5), style: "bodyMedium", color: onSurface, padding: { top: 2 } }));
            }
            else if (trimmed.indexOf("### ") === 0) {
                nodes.push(ctx.UI.Text({ text: trimmed.substring(4), style: "labelMedium", color: onSurface, padding: { top: 4 } }));
            }
            else if (trimmed.indexOf("- ") === 0 || trimmed.indexOf("-  ") === 0) {
                nodes.push(ctx.UI.Text({ text: "  • " + trimmed.replace(/^-\s+/, ""), style: "bodySmall", color: onSurfaceVariant }));
            }
            else {
                nodes.push(ctx.UI.Text({ text: trimmed, style: "bodySmall", color: onSurfaceVariant }));
            }
        }
        return ctx.UI.Column({ spacing: 2 }, nodes);
    }
    // 通用一行开关
    function rowOf(label, desc, state, val) {
        return ctx.UI.Row({ spacing: 4, fillMaxWidth: true, verticalAlignment: "centerVertically" }, [
            ctx.UI.Column({ weight: 1, spacing: 1 }, [
                ctx.UI.Text({ text: label, style: "bodyLarge", color: onSurface }),
                ctx.UI.Text({ text: desc, style: "bodySmall", color: onSurfaceVariant }),
            ]),
            ctx.UI.Switch({
                checked: val,
                onCheckedChange: function (b) { state[1](b); savedState[1](false); },
            }),
        ]);
    }
    // ===== 规则设置 Card =====
    var rulesSection = ctx.UI.Card({ fillMaxWidth: true, containerColor: surfaceVariant }, [
        ctx.UI.Column({ padding: 16, spacing: 8 }, [
            ctx.UI.Text({ text: "UNO 规则设置", style: "titleSmall", color: onSurface }),
            ctx.UI.Text({ text: "设置影响之后新创建的对局；进行中的对局使用创建时的规则快照。", style: "bodySmall", color: onSurfaceVariant }),
            rowOf("出牌方式", "开启=一次只能出一张（官方）；关闭=允许同色/同数字成组出牌", singleOnlyState, singleOnly),
            ctx.UI.Divider({ thickness: 0.5, color: onSurfaceVariant }),
            rowOf("+2/+4 叠加", "开启=对手可接招反击累加罚抽（变体）；关闭=官方不叠加", stackingState, stacking),
            ctx.UI.Divider({ thickness: 0.5, color: onSurfaceVariant }),
            rowOf("剩最后1张喊 UNO", "开启=剩1张时喊 UNO（官方）；关闭=不喊", requireUnoState, requireUno),
            ctx.UI.Row({ spacing: 8, padding: { top: 8 } }, [
                ctx.UI.Button({
                    onClick: saveRules,
                    containerColor: primary,
                    content: ctx.UI.Text({ text: "保存规则", style: "labelMedium", color: onPrimary }),
                }),
                ctx.UI.OutlinedButton({
                    onClick: function () {
                        singleOnlyState[1](true);
                        stackingState[1](false);
                        requireUnoState[1](true);
                        savedState[1](false);
                    },
                    content: ctx.UI.Text({ text: saved ? "✓ 已保存" : "重置为官方默认", style: "labelLarge", color: saved ? primary : onSurface }),
                }),
            ]),
        ]),
    ]);
    // ===== 版本检查 Card =====
    var versionCheckCard = ctx.UI.Card({ fillMaxWidth: true, containerColor: surfaceVariant }, [
        ctx.UI.Column({ padding: 16, spacing: 8 }, [
            ctx.UI.Text({ text: "版本检查", style: "titleSmall", color: onSurface }),
            ctx.UI.Text({ text: "当前版本：" + _fmtVer(_PLUGIN_VER), style: "bodyMedium", color: onSurfaceVariant }),
            ctx.UI.Text({ text: "信息源：", style: "labelSmall", color: onSurfaceVariant }),
            ctx.UI.LazyRow({ spacing: 6 }, _infoLabels.map(function (label, idx) {
                return ctx.UI.FilterChip({
                    key: "info_" + idx,
                    selected: infoSourceState[0] === idx,
                    onClick: function () { infoSourceState[1](idx); },
                    label: ctx.UI.Text({ text: label, style: "labelSmall", color: infoSourceState[0] === idx ? onPrimary : onSurface }),
                    leadingIcon: infoSourceState[0] === idx ? ctx.UI.Icon({ name: "check", size: 14, tint: onPrimary }) : null,
                });
            })),
            ctx.UI.Button({
                onClick: fetchPluginInfo,
                fillMaxWidth: true,
                containerColor: infoStatus === "loading" ? onSurfaceVariant : primary,
                content: infoStatus === "loading"
                    ? ctx.UI.CircularProgressIndicator({ strokeWidth: 2, color: onPrimary })
                    : ctx.UI.Text({ text: "检查更新 / 获取更新历程", style: "labelMedium", color: onPrimary }),
            }),
            versionInfo ? ctx.UI.Text({ text: versionInfo, style: "bodySmall", color: versionInfo.indexOf("⚠") >= 0 ? "rgba(244,67,54,1)" : onSurfaceVariant }) : null,
        ]),
    ]);
    // ===== 更新历程 Card =====
    var changelogCard = ctx.UI.Card({ fillMaxWidth: true, containerColor: surfaceVariant }, [
        ctx.UI.Column({ padding: 16, spacing: 8 }, [
            ctx.UI.Text({ text: "更新历程", style: "titleSmall", color: onSurface }),
            ctx.UI.Text({ text: "点击上方「检查更新 / 获取更新历程」后显示", style: "bodySmall", color: onSurfaceVariant }),
            changelogContent && infoStatus === "done" ? renderChangelogText(changelogContent)
                : (infoStatus === "loading" ? ctx.UI.CircularProgressIndicator({ strokeWidth: 2, color: primary }) : null),
        ]),
    ]);
    return ctx.UI.LazyColumn({ fillMaxSize: true, spacing: 12, padding: { horizontal: 16, top: 16, bottom: 24 } }, [
        ctx.UI.Row({ spacing: 6, verticalAlignment: "centerVertically" }, [
            ctx.UI.Icon({ name: "style", size: 22, tint: primary }),
            ctx.UI.Text({ text: "UNO 对战设置", style: "titleLarge", color: primary }),
        ]),
        rulesSection,
        versionCheckCard,
        changelogCard,
    ]);
}
