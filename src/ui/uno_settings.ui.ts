// @ts-nocheck
// UNO 规则设置 UI（工具箱）：用环境变量存储规则（参考 questionnaire）
// 规则读取用 getEnv，保存用 Tools.SoftwareSettings.writeEnvironmentVariable
// 注意：这里改的是全局规则，只影响之后新创建的实例；进行中的实例从 json 读已快照的规则。

function _readBool(key: string, def: boolean): boolean {
  if (typeof getEnv !== "function") return def;
  try {
    var v = getEnv(key);
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  } catch (e) {}
  return def;
}

export default function Screen(ctx: any): any {
  var primary = ctx.MaterialTheme.colorScheme.primary;
  var onSurface = ctx.MaterialTheme.colorScheme.onSurface;
  var onSurfaceVariant = ctx.MaterialTheme.colorScheme.onSurfaceVariant;
  var surfaceVariant = ctx.MaterialTheme.colorScheme.surfaceVariant;

  var singleOnlyState = ctx.useState("_single", _readBool("UNO_SINGLE_ONLY", true));
  var stackingState = ctx.useState("_stacking", _readBool("UNO_STACKING", false));
  var requireUnoState = ctx.useState("_requireUno", _readBool("UNO_REQUIRE_UNO", true));
  var savedState = ctx.useState("_saved", false);

  var singleOnly = singleOnlyState[0];
  var stacking = stackingState[0];
  var requireUno = requireUnoState[0];
  var saved = savedState[0];

  function saveRules() {
    try {
      Tools.SoftwareSettings.writeEnvironmentVariable("UNO_SINGLE_ONLY", String(singleOnly));
      Tools.SoftwareSettings.writeEnvironmentVariable("UNO_STACKING", String(stacking));
      Tools.SoftwareSettings.writeEnvironmentVariable("UNO_REQUIRE_UNO", String(requireUno));
      savedState[1](true);
      try { ctx.showToast("✓ 规则已保存（影响之后新开的对局）"); } catch (e) {}
    } catch (e) {
      try { ctx.showToast("保存失败：" + String(e)); } catch (e2) {}
    }
  }

  // 通用一行开关
  function rowOf(label: string, desc: string, state: any, val: boolean): any {
    return ctx.UI.Row({ spacing: 4, fillMaxWidth: true, verticalAlignment: "centerVertically" }, [
      ctx.UI.Column({ weight: 1, spacing: 1 }, [
        ctx.UI.Text({ text: label, style: "bodyLarge", color: onSurface }),
        ctx.UI.Text({ text: desc, style: "bodySmall", color: onSurfaceVariant }),
      ]),
      ctx.UI.Switch({
        checked: val,
        onCheckedChange: function (b: boolean) { state[1](b); savedState[1](false); },
      }),
    ]);
  }

  var nodes: any[] = [];
  nodes.push(ctx.UI.Column({ spacing: 2, padding: { vertical: 4, horizontal: 4 } }, [
    ctx.UI.Text({ text: "🎴 UNO 规则设置", style: "titleLarge", color: primary }),
    ctx.UI.Text({ text: "设置影响之后新创建的对局；进行中的对局使用创建时的规则快照。", style: "bodySmall", color: onSurfaceVariant }),
  ]));

  nodes.push(
    ctx.UI.Card({ fillMaxWidth: true, containerColor: surfaceVariant }, [
      ctx.UI.Column({ padding: 16, spacing: 12 }, [
        rowOf("出牌方式", "开启=一次只能出一张（官方）；关闭=允许同色/同数字成组出牌", singleOnlyState, singleOnly),
        ctx.UI.Divider({ thickness: 0.5, color: onSurfaceVariant }),
        rowOf("+2/+4 叠加", "开启=对手可接招反击累加罚抽（变体）；关闭=官方不叠加", stackingState, stacking),
        ctx.UI.Divider({ thickness: 0.5, color: onSurfaceVariant }),
        rowOf("剩最后1张喊 UNO", "开启=剩1张时喊 UNO（官方）；关闭=不喊", requireUnoState, requireUno),
      ]),
    ])
  );

  nodes.push(
    ctx.UI.Row({ spacing: 8, padding: { vertical: 8 } }, [
      ctx.UI.Button({ text: "保存规则", onClick: saveRules, containerColor: primary }),
      ctx.UI.OutlinedButton({
        content: ctx.UI.Text({ text: saved ? "✓ 已保存" : "重置为官方默认", style: "labelLarge", color: saved ? primary : onSurface }),
        onClick: function () {
          singleOnlyState[1](true); stackingState[1](false); requireUnoState[1](true); savedState[1](false);
        },
      }),
    ])
  );

  if (saved) {
    nodes.push(ctx.UI.Text({ text: "✓ 规则已保存", style: "bodyMedium", color: primary }));
  }

  return ctx.UI.Column({ spacing: 8, padding: { vertical: 12, horizontal: 12 } }, nodes);
}