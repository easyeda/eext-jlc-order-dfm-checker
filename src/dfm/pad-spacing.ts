import type { CheckResult } from './types';

/**
 * 两线段最短距离(胶囊体几何:焊盘 = 沿长轴的线段 + 半径膨胀)。
 * 标准 segment-segment 距离算法;圆/方焊盘线段退化为点 → 点到点/点到线段。
 */
function segmentDistance(
    p1x: number, p1y: number, p2x: number, p2y: number,
    p3x: number, p3y: number, p4x: number, p4y: number,
): number {
    const d1x = p2x - p1x;
    const d1y = p2y - p1y;
    const d2x = p4x - p3x;
    const d2y = p4y - p3y;
    const rx = p1x - p3x;
    const ry = p1y - p3y;
    const a = d1x * d1x + d1y * d1y; // |seg1|^2
    const e = d2x * d2x + d2y * d2y; // |seg2|^2
    const f = d2x * rx + d2y * ry;
    const EPS = 1e-12;
    let s: number;
    let t: number;
    if (a <= EPS && e <= EPS)
        return Math.sqrt(rx * rx + ry * ry);
    if (a <= EPS) {
        s = 0;
        t = Math.min(1, Math.max(0, f / e));
    }
    else {
        const c = d1x * rx + d1y * ry;
        if (e <= EPS) {
            t = 0;
            s = Math.min(1, Math.max(0, -c / a));
        }
        else {
            const b = d1x * d2x + d1y * d2y;
            const denom = a * e - b * b;
            s = denom !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
            t = (b * s + f) / e;
            if (t < 0) {
                t = 0;
                s = Math.min(1, Math.max(0, -c / a));
            }
            else if (t > 1) {
                t = 1;
                s = Math.min(1, Math.max(0, (b - c) / a));
            }
        }
    }
    const cx1 = p1x + s * d1x;
    const cy1 = p1y + s * d1y;
    const cx2 = p3x + t * d2x;
    const cy2 = p3y + t * d2y;
    const ddx = cx1 - cx2;
    const ddy = cy1 - cy2;
    return Math.sqrt(ddx * ddx + ddy * ddy);
}

/**
 * 同网络焊盘间距检查(独立菜单,不依赖 DFM 标准表)
 *
 * 检测同一网络、同一层的焊盘两两之间的边到边间距,低于手动设定阈值则报告违规
 * (焊接连锡 / 阻焊桥风险)。
 *
 * - 网络:用权威映射 netById(eda.pcb_Net.getAllNetsName + getAllPrimitivesByNet)
 *   查每个焊盘的网络 —— Pad.getState_Net() 对 SMT 焊盘常返回 undefined,故查网络系统。
 * - 分组:按网络分组;两两比较时判定是否共面 —— 多层焊盘(layer=12 通孔)同时贯穿顶/底,与顶层(1)/底层(2) SMT 焊盘共面、可能连锡/抢阻焊桥,必须比较;反之顶 SMT ↔ 底 SMT 在正反两面不会连锡,不比较。
 * - 几何:胶囊体(stadium)。半径 = 短轴 min(w,h)/2(短轴真实,规避元件焊盘幽灵长轴);沿长轴线段半长 = (长轴-短轴)/2,边到边 = 两线段最短距 - r1 - r2(长圆端弧精确,直线边亦准)。
 *   圆/方焊盘 halfLen≈0 → 退化为圆(快路径,与旧版一致)。注:元件焊盘若有幽灵长轴,胶囊会沿幽灵方向偏长,可能多报(漏报→多报,DFM 偏安全)。
 * - 违规:边到边 < 阈值即报(含重叠/相接 edge<0 —— 半径已用 min(w,h)/2,同网络独立焊盘重叠属设计碰撞,不再跳过)。
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

        // 缓存焊盘:id(定位用 getAllPrimitiveId) / net / layer / 中心 / 几何(半径/长轴方向/胶囊线段半长)
        const padInfos: Array<{ id: string; net: string; layer: string; x: number; y: number; r: number; ux: number; uy: number; halfLen: number }> = [];
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
            const rot = Number(p.getState_Rotation?.() ?? 0) || 0; // 弧度(jlceda getState_Rotation 返弧度)
            const longIsX = w >= h; // 长轴沿局部 X(w≥h)否则沿 Y
            const ux = longIsX ? Math.cos(rot) : -Math.sin(rot);
            const uy = longIsX ? Math.sin(rot) : Math.cos(rot);
            const halfLen = (Math.max(w, h) - Math.min(w, h)) / 2; // 胶囊长轴线段半长(圆/方=0)
            padInfos.push({
                id: padLocateIds[i] ?? pid,
                net,
                layer: String(p.getState_Layer?.() ?? p.layer ?? p.layerId ?? 0),
                x: p.getState_X?.() ?? p.x ?? 0,
                y: p.getState_Y?.() ?? p.y ?? 0,
                // 半径 = 短轴/2(短轴真实;长轴幽灵不可信故只用短轴做半径);
                // 胶囊沿长轴线段半长 = (长轴-短轴)/2:长圆端弧可精确比较,圆/方 halfLen=0 退化圆
                r: Math.min(w, h) / 2,
                ux,
                uy,
                halfLen,
            });
        }

        // 按网络分组(同网络才可能连锡);是否共面在两两比较时判定
        const groups = new Map<string, typeof padInfos>();
        for (const pi of padInfos) {
            const g = groups.get(pi.net);
            if (g)
                g.push(pi);
            else
                groups.set(pi.net, [pi]);
        }

        // 多层焊盘(layer=12 通孔)同时在顶(1)/底(2)两面 —— 它与顶层/底层 SMT 焊盘共面、可能连锡/抢阻焊桥,必须比较;
        // 顶 SMT(1) ↔ 底 SMT(2) 在板子正反两面不会连锡,不比较。共面即两焊盘层集合有交集。
        const outerLayersOf = (layer: string): Set<string> => (layer === '12' ? new Set(['1', '2']) : new Set([layer]));
        const shareLayer = (a: string, b: string): boolean => {
            const sa = outerLayersOf(a);
            for (const l of outerLayersOf(b))
                if (sa.has(l))
                    return true;
            return false;
        };

        // 组内两两求距:中心距快速预筛 + 胶囊边到边(圆-圆走快路径)
        let minActualMil = Infinity;
        for (const grp of groups.values()) {
            for (let a = 0; a < grp.length; a++) {
                for (let b = a + 1; b < grp.length; b++) {
                    const p1 = grp[a];
                    const p2 = grp[b];
                    if (!shareLayer(p1.layer, p2.layer))
                        continue; // 不共面(如顶↔底 SMT):正反两面不会连锡,跳过
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    // 中心距快速预筛:|dx| 或 |dy| 超 r1+r2+阈值 必然不违规,跳过开方
                    const reach = p1.halfLen + p2.halfLen + p1.r + p2.r + minSpacingMil;
                    if (Math.abs(dx) > reach || Math.abs(dy) > reach)
                        continue;
                    let edge: number;
                    if (p1.halfLen <= 0 && p2.halfLen <= 0) {
                        // 圆-圆(圆/方/幽灵长轴焊盘):中心距 - r1 - r2,与旧版一致
                        edge = Math.sqrt(dx * dx + dy * dy) - p1.r - p2.r;
                    }
                    else {
                        // 胶囊:两焊盘长轴线段最短距 - r1 - r2(长圆端弧精确;端到端相接 edge≈0)
                        const a1x = p1.x - p1.ux * p1.halfLen;
                        const a1y = p1.y - p1.uy * p1.halfLen;
                        const b1x = p1.x + p1.ux * p1.halfLen;
                        const b1y = p1.y + p1.uy * p1.halfLen;
                        const a2x = p2.x - p2.ux * p2.halfLen;
                        const a2y = p2.y - p2.uy * p2.halfLen;
                        const b2x = p2.x + p2.ux * p2.halfLen;
                        const b2y = p2.y + p2.uy * p2.halfLen;
                        edge = segmentDistance(a1x, a1y, b1x, b1y, a2x, a2y, b2x, b2y) - p1.r - p2.r;
                    }
                    if (edge < minActualMil)
                        minActualMil = edge;
                    if (edge < minSpacingMil) {
                        violations.push({
                            x: (p1.x + p2.x) / 2,
                            y: (p1.y + p2.y) / 2,
                            id: p1.id,
                            reason: `同网络(${p1.net})焊盘间距 ${eda.sys_Unit.milToMm(edge).toFixed(3)}mm < ${minSpacingMm}mm${edge < 0 ? '(重叠)' : ''}(焊盘 ${p1.id} ↔ ${p2.id})`,
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
            : `最小 ${eda.sys_Unit.milToMm(minActualMil).toFixed(3)}mm${minActualMil < 0 ? '(重叠)' : ''}`;
    }
    catch (e) {
        result.result = 'warning';
        result.actualValue = `检查出错:${e}`;
    }

    return result;
}
