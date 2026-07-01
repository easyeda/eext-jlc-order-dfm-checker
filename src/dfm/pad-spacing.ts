import type { CheckResult } from './types';

/**
 * 同网络焊盘间距检查(独立菜单,不依赖 DFM 标准表)
 *
 * 检测同一网络、同一层的焊盘两两之间的边到边间距,低于手动设定阈值则报告违规
 * (焊接连锡 / 阻焊桥风险)。
 *
 * - 网络:用权威映射 netById(eda.pcb_Net.getAllNetsName + getAllPrimitivesByNet)
 *   查每个焊盘的网络 —— Pad.getState_Net() 对 SMT 焊盘常返回 undefined,故查网络系统。
 * - 分组:按 网络 + 层 分组,仅同组内两两比较(不同层不会物理连锡)。
 * - 几何:圆近似,半径 = min(w,h)/2(短轴;规避 getState_Pad 对元件焊盘的幽灵长轴);边到边 = 中心距 - r1 - r2。
 *   圆形/方形焊盘准确;细长焊盘偏保守,可调阈值补偿。
 * - 违规:0 <= 边到边 < 阈值。相接/重叠(edge<0)视为同网络正常连接,跳过。
 *
 * @param minSpacingMm 手动设定的最小间距(mm)
 */
export async function checkSameNetPadSpacing(minSpacingMm: number): Promise<CheckResult> {
    const result: CheckResult = {
        number: 1,
        item: '同网络焊盘间距',
        actualValue: '计算中',
        standardValue: `≥${minSpacingMm}mm(手动设置)`,
        result: 'success',
        violations: [],
    };
    const violations: Array<{ x: number; y: number; id: string; reason: string; type: string; locateType?: string }> = [];

    try {
        const pads = await eda.pcb_PrimitivePad.getAll();
        const padLocateIds = await eda.pcb_PrimitivePad.getAllPrimitiveId();

        // 权威网络映射:primitiveId -> netName(直接查 EDA 网络系统,比 Pad.getState_Net 可靠)
        const netById = new Map<string, string>();
        try {
            const netNames = await eda.pcb_Net.getAllNetsName();
            const settled = await Promise.allSettled(
                netNames.map((name: string) => eda.pcb_Net.getAllPrimitivesByNet(name).then((prims: any[]) => ({ name, prims }))),
            );
            for (const r of settled) {
                if (r.status !== 'fulfilled')
                    continue;
                const { name, prims } = (r as any).value;
                if (!Array.isArray(prims))
                    continue;
                for (const prim of prims) {
                    const id = (prim as any).getState_PrimitiveId?.() ?? (prim as any).primitiveId ?? '';
                    if (id)
                        netById.set(id, name);
                }
            }
        }
        catch {
            /* 网络系统查询失败则退回 getState_Net */
        }

        const minSpacingMil = eda.sys_Unit.mmToMil(minSpacingMm);

        // 缓存焊盘:id(定位用 getAllPrimitiveId) / net / layer / 中心 / 圆近似半径
        const padInfos: Array<{ id: string; net: string; layer: string; x: number; y: number; r: number }> = [];
        for (let i = 0; i < pads.length; i++) {
            const p: any = pads[i];
            const pid = String(p.getState_PrimitiveId?.() ?? p.primitiveId ?? '');
            const net = netById.get(pid) ?? p.getState_Net?.() ?? '';
            if (!net)
                continue; // 无网络焊盘跳过
            const shape: any = p.getState_Pad?.() ?? p.pad ?? null;
            if (!Array.isArray(shape) || shape.length < 3)
                continue;
            const w = Number(shape[1]) || 0;
            const h = Number(shape[2]) || 0;
            if (w <= 0 || h <= 0)
                continue;
            padInfos.push({
                id: padLocateIds[i] ?? pid,
                net,
                layer: String(p.getState_Layer?.() ?? p.layer ?? p.layerId ?? 0),
                x: p.getState_X?.() ?? p.x ?? 0,
                y: p.getState_Y?.() ?? p.y ?? 0,
                // 半径取 min(w,h)/2:getState_Pad 对元件焊盘会返幽灵长轴(实测 ~2mm),
                // 用 max 会虚大半径、吃掉真实间距致误报;短轴为真实尺寸,圆/方焊盘 min≈max 不变
                r: Math.min(w, h) / 2,
            });
        }

        // 按 网络+层 分组(不同层不会连锡,不比较)
        const groups = new Map<string, typeof padInfos>();
        for (const pi of padInfos) {
            const key = `${pi.net}@@${pi.layer}`;
            const g = groups.get(key);
            if (g)
                g.push(pi);
            else
                groups.set(key, [pi]);
        }

        // 组内两两求距:中心距快速预筛 + 圆近似边到边
        let minActualMil = Infinity;
        for (const grp of groups.values()) {
            for (let a = 0; a < grp.length; a++) {
                for (let b = a + 1; b < grp.length; b++) {
                    const p1 = grp[a];
                    const p2 = grp[b];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    // 中心距快速预筛:|dx| 或 |dy| 超 r1+r2+阈值 必然不违规,跳过开方
                    const reach = p1.r + p2.r + minSpacingMil;
                    if (Math.abs(dx) > reach || Math.abs(dy) > reach)
                        continue;
                    const center = Math.sqrt(dx * dx + dy * dy);
                    const edge = center - p1.r - p2.r; // 边到边(mil)
                    if (edge < 0)
                        continue; // 相接/重叠:同网络正常连接,跳过
                    if (edge < minActualMil)
                        minActualMil = edge;
                    if (edge < minSpacingMil) {
                        violations.push({
                            x: (p1.x + p2.x) / 2,
                            y: (p1.y + p2.y) / 2,
                            id: p1.id,
                            reason: `同网络(${p1.net})焊盘间距 ${eda.sys_Unit.milToMm(edge).toFixed(3)}mm < ${minSpacingMm}mm(焊盘 ${p1.id} ↔ ${p2.id})`,
                            type: 'pad',
                        });
                    }
                }
            }
        }

        if (violations.length > 0) {
            result.result = 'error';
            result.violations = violations;
        }
        result.actualValue = minActualMil === Infinity
            ? '无同网络同层焊盘对'
            : `最小 ${eda.sys_Unit.milToMm(minActualMil).toFixed(3)}mm`;
    }
    catch (e) {
        result.result = 'warning';
        result.actualValue = `检查出错:${e}`;
    }

    return result;
}
