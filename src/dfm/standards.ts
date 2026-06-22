/**
 * 嘉立创工艺标准定义
 * 基于嘉立创官方工艺参数规范
 * 参考：https://www.jlc.com/portal/vtechnology.html
 */
import type { MaterialStandard, SmtStandardConfig } from './types';

/**
 * 嘉立创支持的板材标准
 */
export const JLC_MATERIAL_STANDARDS: Record<string, MaterialStandard> = {
	FR4: {
		name: 'FR4',
		layerCount: { min: 1, max: 64 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		thicknessRange: { min: 0.4, max: 6.0 },
		outerCopperThickness: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0], // oz
		innerCopperThickness: [0.5, 1.0],
		layerStackup: ['对称结构', '非对称结构'],
		viaTypes: ['through', 'blind'],
		viaHoleDiameterRange: { min: 0.15, max: 6.3 },
		minViaPadDiameter: 0.4,
		slotWithCopperMinSize: { width: 0.6, length: 1.0 },
		slotWithoutCopperMinWidth: 0.6,
		minTraceWidth: 0.15,
		minTraceSpacing: 0.15,
		minPadToLineSpacing: 0.15,
		minPluginPadRingWithCopper: 0.15,
		minPluginPadRingWithoutCopper: 0.2,
		minBgaPadDiameter: 0.25,
		minBgaPadToLineSpacing: 0.15,
		minStringHeight: 0.8,
		minStringWidth: 0.15,
		minStringToCopperSpacing: 0.15,
	},
	CEM1: {
		name: 'CEM-1',
		layerCount: { min: 1, max: 2 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		thicknessRange: { min: 0.8, max: 2.0 },
		outerCopperThickness: [1.0, 2.0], // oz
		viaTypes: ['through'],
		viaHoleDiameterRange: { min: 0.3, max: 6.3 },
		minViaPadDiameter: 0.6,
		slotWithCopperMinSize: { width: 0.8, length: 1.2 },
		slotWithoutCopperMinWidth: 0.8,
		minTraceWidth: 0.2,
		minTraceSpacing: 0.2,
		minPadToLineSpacing: 0.2,
		minPluginPadRingWithCopper: 0.2,
		minPluginPadRingWithoutCopper: 0.25,
		minBgaPadDiameter: 0.4,
		minBgaPadToLineSpacing: 0.2,
		minStringHeight: 1.0,
		minStringWidth: 0.2,
		minStringToCopperSpacing: 0.2,
	},
	铝基板: {
		name: '铝基板',
		layerCount: { min: 1, max: 2 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		thicknessRange: { min: 0.5, max: 3.0 },
		outerCopperThickness: [1.0, 2.0, 3.0], // oz
		viaTypes: ['through'],
		viaHoleDiameterRange: { min: 0.5, max: 6.3 },
		minViaPadDiameter: 0.8,
		slotWithCopperMinSize: { width: 1.0, length: 1.5 },
		slotWithoutCopperMinWidth: 1.0,
		minTraceWidth: 0.2,
		minTraceSpacing: 0.2,
		minPadToLineSpacing: 0.2,
		minPluginPadRingWithCopper: 0.2,
		minPluginPadRingWithoutCopper: 0.25,
		minBgaPadDiameter: 0.5,
		minBgaPadToLineSpacing: 0.2,
		minStringHeight: 1.0,
		minStringWidth: 0.2,
		minStringToCopperSpacing: 0.25,
	},
	铜基板: {
		name: '铜基板',
		layerCount: { min: 1, max: 2 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		thicknessRange: { min: 1.0, max: 3.0 },
		outerCopperThickness: [1.0, 2.0, 3.0], // oz
		viaTypes: ['through'],
		viaHoleDiameterRange: { min: 0.5, max: 6.3 },
		minViaPadDiameter: 0.8,
		slotWithCopperMinSize: { width: 1.0, length: 1.5 },
		slotWithoutCopperMinWidth: 1.0,
		minTraceWidth: 0.2,
		minTraceSpacing: 0.2,
		minPadToLineSpacing: 0.2,
		minPluginPadRingWithCopper: 0.2,
		minPluginPadRingWithoutCopper: 0.25,
		minBgaPadDiameter: 0.5,
		minBgaPadToLineSpacing: 0.2,
		minStringHeight: 1.0,
		minStringWidth: 0.2,
		minStringToCopperSpacing: 0.25,
	},
	高频板: {
		name: '高频板',
		layerCount: { min: 1, max: 32 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		thicknessRange: { min: 0.4, max: 3.0 },
		outerCopperThickness: [0.5, 1.0, 1.5, 2.0], // oz
		innerCopperThickness: [0.5, 1.0],
		layerStackup: ['对称结构', '非对称结构'],
		viaTypes: ['through'],
		viaHoleDiameterRange: { min: 0.2, max: 6.3 },
		minViaPadDiameter: 0.5,
		slotWithCopperMinSize: { width: 0.8, length: 1.2 },
		slotWithoutCopperMinWidth: 0.8,
		minTraceWidth: 0.15,
		minTraceSpacing: 0.15,
		minPadToLineSpacing: 0.15,
		minPluginPadRingWithCopper: 0.15,
		minPluginPadRingWithoutCopper: 0.2,
		minBgaPadDiameter: 0.3,
		minBgaPadToLineSpacing: 0.15,
		minStringHeight: 0.8,
		minStringWidth: 0.15,
		minStringToCopperSpacing: 0.15,
	},
	HDI板: {
		name: 'HDI板',
		layerCount: { min: 4, max: 32 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		thicknessRange: { min: 0.4, max: 2.5 },
		outerCopperThickness: [0.5, 1.0, 1.5, 2.0], // oz
		innerCopperThickness: [0.5, 1.0],
		layerStackup: ['对称结构', '非对称结构', 'HDI结构'],
		viaTypes: ['through', 'blind'],
		viaHoleDiameterRange: { min: 0.1, max: 0.6 }, // 盲埋孔
		minViaPadDiameter: 0.25,
		slotWithCopperMinSize: { width: 0.5, length: 0.8 },
		slotWithoutCopperMinWidth: 0.5,
		minTraceWidth: 0.1,
		minTraceSpacing: 0.1,
		minPadToLineSpacing: 0.1,
		minPluginPadRingWithCopper: 0.1,
		minPluginPadRingWithoutCopper: 0.15,
		minBgaPadDiameter: 0.2,
		minBgaPadToLineSpacing: 0.1,
		minStringHeight: 0.6,
		minStringWidth: 0.1,
		minStringToCopperSpacing: 0.1,
	},
};

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
		solderingSides: ['both'],
		layerCounts: [2, 4, 6],
		thicknessRange: { min: 0.8, max: 1.6 },
		sizeRange: { minWidth: 10, maxWidth: 470, minLength: 10, maxLength: 570 },
		minPackage: '0402',
	},
	standard: {
		name: '标准型',
		solderingSides: ['both'],
		layerCounts: [], // 无限制
		thicknessRange: { min: 0.4, max: 6.0 }, // 无限制实际使用合理范围
		sizeRange: { minWidth: 70, maxWidth: 460, minLength: 70, maxLength: 510 },
		minPackage: '0201',
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
