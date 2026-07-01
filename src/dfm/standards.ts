/**
 * 嘉立创工艺标准定义
 * 基于嘉立创官方工艺参数规范
 * 参考：https://www.jlc.com/portal/vtechnology.html
 */
import type { MaterialStandard, SmtStandardConfig, ViaSpec } from './types';

/**
 * 嘉立创支持的板材标准
 */
export const JLC_MATERIAL_STANDARDS: Record<string, MaterialStandard> = {
	FR4: {
		name: 'FR4',
		layerCount: { min: 1, max: 64 },
		minSize: { width: 3, length: 3 },
		maxSize: { width: 656, length: 586 },
		// 最大尺寸按层数(层数越多尺寸越小):取适用该层数的最严格档
		maxSizeByLayers: [
			{ minLayers: 6, max: { width: 656, length: 586 } },
			{ minLayers: 4, max: { width: 663, length: 593 } },
			{ minLayers: 2, max: { width: 670, length: 600 } },
			{ minLayers: 1, max: { width: 606, length: 510 } },
		],
		thicknessRange: { min: 0.4, max: 4.8 },
		outerCopperThickness: [1, 2, 2.5, 3.5, 4.5, 5, 6],
		// 多层板(>=3层)外层铜厚仅1/2oz;双面板(<=2层)用上面的全列表
		outerCopperThicknessByLayers: [
			{ minLayers: 3, values: [1, 2] },
		],
		innerCopperThickness: [0.5, 1, 2],
		viaTypes: ['through'],
		// 过孔焊盘外径按单/双/多层分段:1层0.3/0.5,双面多层0.15/0.25
		viaSpecsByLayers: [
			{ minLayers: 3, spec: { throughHole: { min: 0.15, max: 6.3 }, minPadOuter: 0.25 } },
			{ minLayers: 2, spec: { throughHole: { min: 0.15, max: 6.3 }, minPadOuter: 0.25 } },
			{ minLayers: 1, spec: { throughHole: { min: 0.3, max: 6.3 }, minPadOuter: 0.5 } },
		],
		// 有铜槽按双面/多层分段:双面0.5/1.0,多层0.35/0.70
		slotWithCopperByLayers: [
			{ minLayers: 3, width: 0.35, length: 0.70 },
			{ minLayers: 2, width: 0.5, length: 1.0 },
		],
		slotWithoutCopperMinWidth: 1.0,
		// 线宽/线距按铜厚分段(铜厚越大线越粗);1oz/2oz 多层板更细(0.09/0.15),厚铜仅单双面
		traceSpecsByCopper: [
			{ copperOz: 1, minWidth: 0.10, minSpacing: 0.10, multiLayerMinWidth: 0.09, multiLayerMinSpacing: 0.09 },
			{ copperOz: 2, minWidth: 0.16, minSpacing: 0.16, multiLayerMinWidth: 0.15, multiLayerMinSpacing: 0.15 },
			{ copperOz: 2.5, minWidth: 0.20, minSpacing: 0.20 },
			{ copperOz: 3.5, minWidth: 0.25, minSpacing: 0.25 },
			{ copperOz: 4.5, minWidth: 0.30, minSpacing: 0.30 },
			{ copperOz: 5, minWidth: 0.35, minSpacing: 0.35 },
			{ copperOz: 6, minWidth: 0.45, minSpacing: 0.45 },
		],
		minPadToLineSpacing: 0.1,
		minBgaPadToLineSpacing: 0.09,
	},
	HDI板: {
		name: 'HDI板',
		layerCount: { min: 4, max: 32 },
		minSize: { width: 5, length: 5 },
		maxSize: { width: 576, length: 469 },
		thicknessRange: { min: 0.5, max: 2.4 },
		outerCopperThickness: [1],
		innerCopperThickness: [1],
		viaTypes: ['through', 'blind'],
		// 通孔>=0.15,盲孔0.075-0.15,埋孔0.15-0.55;焊盘外径=内径+0.15(盲埋)/内径+0.1(通)
		viaSpec: {
			throughHole: { min: 0.15, max: 6.3 },
			blindHole: { min: 0.075, max: 0.15 },
			buriedHole: { min: 0.15, max: 0.55 },
			minPadOuter: 0.25,
		},
		slotWithoutCopperMinWidth: 1.0,
		minTraceWidth: 0.075,
		minTraceSpacing: 0.075,
		minPadToLineSpacing: 0.15,
		minBgaPadToLineSpacing: 0.15,
	},
	高频板: {
		name: '高频板',
		layerCount: { min: 2, max: 2 },
		minSize: { width: 3, length: 3 },
		maxSize: { width: 590, length: 438 },
		thicknessValues: [0.51, 0.76, 1.52],
		thicknessRange: { min: 0.51, max: 1.52 },
		// 板厚显示文案(罗杰斯/铁氟龙分别支持厚度),实际判定仍用 thicknessValues
		thicknessDescription: '罗杰斯板：0.51mm、0.76mm、1.52mm　　铁氟龙板：0.76mm、1.52mm',
		outerCopperThickness: [1],
		viaTypes: ['through'],
		viaSpec: { throughHole: { min: 0.15, max: 6.3 }, minPadOuter: 0.25 },
		// PTFE(铁氟龙)最小钻孔0.3mm(罗杰斯板0.15mm),显示在第8项标准值
		drillNote: 'PTFE(铁氟龙)支持最小0.3mm钻孔',
		slotWithoutCopperMinWidth: 1.0,
		minTraceWidth: 0.1,
		minTraceSpacing: 0.1,
		minPadToLineSpacing: 0.15,
		minBgaPadToLineSpacing: 0.15,
	},
	铝基板: {
		name: '铝基板',
		layerCount: { min: 1, max: 1 },
		minSize: { width: 5, length: 5 },
		maxSize: { width: 602, length: 506 },
		thicknessValues: [0.8, 1.0, 1.2, 1.6],
		thicknessRange: { min: 0.8, max: 1.6 },
		outerCopperThickness: [1],
		viaTypes: ['through'],
		viaSpec: { throughHole: { min: 0.65, max: 6.3 }, minPadOuter: 1.05 },
		slotWithoutCopperMinWidth: 1.0,
		minTraceWidth: 0.1,
		minTraceSpacing: 0.1,
		minPadToLineSpacing: 0.15,
		minBgaPadToLineSpacing: 0.15,
	},
	铜基板: {
		name: '铜基板',
		layerCount: { min: 1, max: 2 },
		minSize: { width: 5, length: 5 },
		maxSize: { width: 480, length: 286 },
		thicknessValues: [1.0, 1.2, 1.6],
		thicknessRange: { min: 1.0, max: 1.6 },
		outerCopperThickness: [1],
		viaTypes: ['through'],
		// 通孔按层数:1层板>=1.0、2层板>=0.3;焊盘外径=内径+0.4(取代表值0.7)
		viaSpec: { throughHole: { min: 0.3, max: 6.3 }, minPadOuter: 0.7 },
		// 常规单侧型:1层板通孔>=1.0、2层板>=0.3(特殊夹心型有铜孔0.3-2.0/无铜孔>=1.0 需人工判定)
		viaSpecsByLayers: [
			{ minLayers: 2, spec: { throughHole: { min: 0.3, max: 6.3 }, minPadOuter: 0.7 } },
			{ minLayers: 1, spec: { throughHole: { min: 1.0, max: 6.3 }, minPadOuter: 0.7 } },
		],
		slotWithoutCopperMinWidth: 1.0,
		minTraceWidth: 0.1,
		minTraceSpacing: 0.1,
		minPadToLineSpacing: 0.15,
		minBgaPadToLineSpacing: 0.15,
	},
};

/**
 * 按层数取最大尺寸:maxSizeByLayers 取适用该层数的最严格档(最大 minLayers <= layerCount),
 * 无分段表回退 maxSize。
 */
export function resolveMaxSize(s: MaterialStandard, layerCount: number): { width: number; length: number } {
	if (s.maxSizeByLayers && s.maxSizeByLayers.length > 0) {
		const applicable = s.maxSizeByLayers.filter((e) => layerCount >= e.minLayers);
		if (applicable.length > 0) {
			return applicable.slice().sort((a, b) => b.minLayers - a.minLayers)[0].max;
		}
		return s.maxSizeByLayers.slice().sort((a, b) => a.minLayers - b.minLayers)[0].max;
	}
	return s.maxSize;
}

/**
 * 按层数取过孔规格:viaSpecsByLayers 取适用该层数的最严格档,无分段表回退 viaSpec。
 */
export function resolveViaSpec(s: MaterialStandard, layerCount: number): ViaSpec | undefined {
	if (s.viaSpecsByLayers && s.viaSpecsByLayers.length > 0) {
		const applicable = s.viaSpecsByLayers.filter((e) => layerCount >= e.minLayers);
		if (applicable.length > 0) {
			return applicable.slice().sort((a, b) => b.minLayers - a.minLayers)[0].spec;
		}
		return s.viaSpecsByLayers.slice().sort((a, b) => a.minLayers - b.minLayers)[0].spec;
	}
	return s.viaSpec;
}

/**
 * 按层数取有铜槽孔最小尺寸:slotWithCopperByLayers 取适用档,无分段表回退 slotWithCopperMinSize。
 */
export function resolveSlotWithCopper(
	s: MaterialStandard,
	layerCount: number,
): { width: number; length: number } | undefined {
	if (s.slotWithCopperByLayers && s.slotWithCopperByLayers.length > 0) {
		const applicable = s.slotWithCopperByLayers.filter((e) => layerCount >= e.minLayers);
		if (applicable.length > 0) {
			const hit = applicable.slice().sort((a, b) => b.minLayers - a.minLayers)[0];
			return { width: hit.width, length: hit.length };
		}
		const fallback = s.slotWithCopperByLayers.slice().sort((a, b) => a.minLayers - b.minLayers)[0];
		return { width: fallback.width, length: fallback.length };
	}
	return s.slotWithCopperMinSize;
}

/**
 * 按铜厚+层数取最小线宽/线距:traceSpecsByCopper 向上取整到覆盖该铜厚的最小档(铜厚越大线越粗);
 * 多层板(≥3层)且该档有多层专用值时取更细的多层值;无分段表回退 minTraceWidth/minTraceSpacing。
 */
export function resolveMinTrace(s: MaterialStandard, copperOz: number, layerCount = 0): { width: number; spacing: number } {
	if (s.traceSpecsByCopper && s.traceSpecsByCopper.length > 0) {
		const upward = s.traceSpecsByCopper
			.filter((e) => e.copperOz >= copperOz)
			.slice()
			.sort((a, b) => a.copperOz - b.copperOz);
		const tier = upward.length > 0
			? upward[0]
			: s.traceSpecsByCopper.slice().sort((a, b) => b.copperOz - a.copperOz)[0];
		// 多层板(≥3层)且该铜厚档有多层专用值(仅1oz/2oz)时取更细的多层值
		const isMulti = layerCount >= 3;
		const width = isMulti && tier.multiLayerMinWidth != null ? tier.multiLayerMinWidth : tier.minWidth;
		const spacing = isMulti && tier.multiLayerMinSpacing != null ? tier.multiLayerMinSpacing : tier.minSpacing;
		return { width, spacing };
	}
	return { width: s.minTraceWidth ?? 0, spacing: s.minTraceSpacing ?? 0 };
}

/**
 * 按层数取外层铜厚可选值:outerCopperThicknessByLayers 取适用档,无分段表回退 outerCopperThickness
 */
export function resolveOuterCopper(s: MaterialStandard, layerCount: number): number[] {
	if (s.outerCopperThicknessByLayers && s.outerCopperThicknessByLayers.length > 0) {
		const applicable = s.outerCopperThicknessByLayers.filter((e) => layerCount >= e.minLayers);
		if (applicable.length > 0) {
			return applicable.slice().sort((a, b) => b.minLayers - a.minLayers)[0].values;
		}
	}
	return s.outerCopperThickness;
}

/**
 * 嘉立创支持的板材名称列表
 */
export const JLC_SUPPORTED_MATERIALS = Object.keys(JLC_MATERIAL_STANDARDS);

/**
 * SMT 标准配置
 */
export const SMT_STANDARDS: Record<'economy' | 'standard', SmtStandardConfig> = {
	economy: {
		name: '经济型',
		solderingSides: ['top', 'bottom'],
		layerCounts: [2, 4, 6],
		thicknessRange: { min: 0.8, max: 1.6 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		minPackage: '0402',
		icPinPitchMin: 0.4,
		bgaPitchMin: 0.5,
	},
	standard: {
		name: '标准型',
		solderingSides: ['both'],
		layerCounts: [], // 无限制
		thicknessRange: { min: 0.4, max: 6.0 }, // 无限制实际使用合理范围
		sizeRange: { minWidth: 70, maxWidth: 460, minLength: 70, maxLength: 510 },
		minPackage: '0201',
		icPinPitchMin: 0.35,
		bgaPitchMin: 0.3,
	},
};

/**
 * 常用封装尺寸列表（按从小到大排序）
 */
export const COMMON_PACKAGES = [
	'01005',
	'0201',
	'0402',
	'0603',
	'0805',
	'1206',
	'SOT23',
	'SOT323',
	'SOT89',
	'DFN',
	'QFN',
	'SOP',
	'SSOP',
	'TSSOP',
	'QFP',
	'BGA',
	'LQFP',
];

/**
 * 封装尺寸比较函数
 * @param pkg1 封装1
 * @param pkg2 封装2
 * @returns pkg1 是否比 pkg2 小
 */
export function isPackageSmaller(pkg1: string, pkg2: string): boolean {
	const idx1 = COMMON_PACKAGES.indexOf(pkg1);
	const idx2 = COMMON_PACKAGES.indexOf(pkg2);
	return idx1 >= 0 && idx2 >= 0 && idx1 < idx2;
}

/**
 * 贴片阻容 EIA 尺寸代码（按从小到大），用于“最小封装”判定
 */
export const EIA_PACKAGE_SIZES = ['01005', '0201', '0402', '0603', '0805', '1206'];

/**
 * 把元件封装名归一化为 EIA 尺寸代码
 * 兼容常见前缀(R/C/L/D 等)、后缀(W/M 等)与分隔符(- _ 空格)：
 * “R0402” / “C0402M” / “0402-W” → “0402”；“SOT-23” 等非阻容尺寸 → null
 * @param fpName 封装名
 * @returns EIA 尺寸代码，无法识别返回 null
 */
export function normalizeEiaPackage(fpName: string): string | null {
	if (!fpName) {
		return null;
	}
	const s = fpName.toUpperCase().replace(/[^0-9A-Z]/g, '');
	// 按长度降序匹配，避免短代码误命中长封装名里的子串
	for (const pkg of [...EIA_PACKAGE_SIZES].sort((a, b) => b.length - a.length)) {
		if (s.includes(pkg)) {
			return pkg;
		}
	}
	return null;
}
