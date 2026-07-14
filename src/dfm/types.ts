/**
 * DFM 检查模块类型定义
 */

/**
 * 检查结果类型
 */
export type CheckResultType = 'success' | 'warning' | 'error';

/**
 * 单项检查结果
 */
export interface CheckResult {
	/** 编号 */
	number: number;
	/** 检测项目名称 */
	item: string;
	/** 鼠标悬停描述(结果窗「检测项目」列 title;由 showDfmResults 按 item 名集中挂载) */
	description?: string;
	/** PCB实际值 */
	actualValue: string;
	/** 嘉立创标准值 */
	standardValue: string;
	/** 比对结果 */
	result: CheckResultType;
	/** 违规坐标（如果有） */
	violations?: ViolationCoord[];
}

/**
 * 违规坐标信息
 */
export interface ViolationCoord {
	/** X坐标 */
	x: number;
	/** Y坐标 */
	y: number;
	/** 元素ID */
	id: string;
	/** 违规原因 */
	reason: string;
	/** 元素类型(pad/via/line/string/component 等,放宽为 string 以兼容各检查的内联声明) */
	type: string;
	/** 定位用图元类型(EPCB_PrimitiveType 枚举值,如 Via/ComponentPad/Line/String,供日志点击定位) */
	locateType?: string;
}

/**
 * PCB DFM 检查结果
 */
export interface PcbDfmResult {
	/** 检查时间戳 */
	timestamp: number;
	/** 所有检查结果 */
	results: CheckResult[];
	/** 检查通过 */
	passed: boolean;
	/** 错误数量 */
	errorCount: number;
	/** 警告数量 */
	warningCount: number;
}

/**
 * SMT DFM 检查结果
 */
export interface SmtDfmResult {
	/** 检查时间戳 */
	timestamp: number;
	/** 使用的标准 */
	standard: 'economy' | 'standard';
	/** 所有检查结果 */
	results: CheckResult[];
	/** 检查通过 */
	passed: boolean;
	/** 错误数量 */
	errorCount: number;
	/** 警告数量 */
	warningCount: number;
}

/**
 * 嘉立创板材标准
 *
 * 各板材特有参数:层数/尺寸/板厚/铜厚/过孔/线宽/焊盘到线(部分按层数或铜厚分段);
 * 共用参数(字符/焊环/BGA焊盘直径)见 SHARED_DFM_STANDARDS。
 * 标准源:板材标准.txt
 */
/** 按层数分段的最大尺寸 */
export interface SizeByLayers {
	minLayers: number;
	max: { width: number; length: number };
}
/** 按铜厚分段的最小线宽/线距 */
export interface TraceSpecByCopper {
	copperOz: number;
	/** 单双面板最小线宽 */
	minWidth: number;
	/** 单双面板最小线距 */
	minSpacing: number;
	/** 多层板(≥3层)最小线宽(更细;仅 1oz/2oz 有,厚铜不支持多层) */
	multiLayerMinWidth?: number;
	/** 多层板(≥3层)最小线距 */
	multiLayerMinSpacing?: number;
}
/** 过孔规格(通孔/盲孔/埋孔 + 焊盘外径) */
export interface ViaSpec {
	throughHole?: { min: number; max: number };
	blindHole?: { min: number; max: number };
	buriedHole?: { min: number; max: number };
	minPadOuter?: number;
}
/** 按层数分段的过孔规格 */
export interface ViaSpecByLayers {
	minLayers: number;
	spec: ViaSpec;
}

export interface MaterialStandard {
	/** 板材名称 */
	name: string;
	/** 支持的层数 */
	layerCount: { min: number; max: number };
	/** 最小尺寸 */
	minSize: { width: number; length: number };
	/** 最大尺寸(单一) */
	maxSize: { width: number; length: number };
	/** 最大尺寸按层数分段(FR4) */
	maxSizeByLayers?: SizeByLayers[];
	/** 板厚范围 */
	thicknessRange: { min: number; max: number };
	/** 离散板厚(高频/铝/铜) */
	thicknessValues?: number[];
	/** 板厚显示文案(高频板区分罗杰斯/铁氟龙);不设则由 thicknessValues/thicknessRange 自动生成 */
	thicknessDescription?: string;
	/** 支持的外层铜厚(oz) */
	outerCopperThickness: number[];
	/** 外层铜厚按层数分段(FR4:多层板仅1/2oz,双面板用outerCopperThickness) */
	outerCopperThicknessByLayers?: Array<{ minLayers: number; values: number[] }>;
	/** 支持的内层铜厚(oz) */
	innerCopperThickness?: number[];
	/** 支持的过孔类型 */
	viaTypes: ('through' | 'blind')[];
	/** 过孔规格(非FR4单一) */
	viaSpec?: ViaSpec;
	/** 过孔规格按层数分段(FR4) */
	viaSpecsByLayers?: ViaSpecByLayers[];
	/** 钻孔(第8项)标准补充说明,如高频板 PTFE 最小0.3mm 限制 */
	drillNote?: string;
	/** 有铜槽孔最小尺寸按层数分段(FR4) */
	slotWithCopperByLayers?: Array<{ minLayers: number; width: number; length: number }>;
	/** 有铜槽孔最小尺寸(单一) */
	slotWithCopperMinSize?: { width: number; length: number };
	/** 无铜槽孔最小宽度 */
	slotWithoutCopperMinWidth: number;
	/** 最小线宽/线距按铜厚分段(FR4) */
	traceSpecsByCopper?: TraceSpecByCopper[];
	/** 最小线宽(单一) */
	minTraceWidth?: number;
	/** 最小线距(单一) */
	minTraceSpacing?: number;
	/** 焊盘/过孔到线最小间距 */
	minPadToLineSpacing: number;
	/** BGA焊盘边到线最小间距 */
	minBgaPadToLineSpacing: number;
}

/**
 * 各板材共用 DFM 参数(字符/焊环/BGA焊盘直径)
 * 标准源:板材标准.txt 第141行(各板材共用)
 */
export const SHARED_DFM_STANDARDS = {
	minStringHeight: 0.8,
	minStringWidth: 0.15,
	minStringToCopperSpacing: 0.15,
	minPluginPadRingWithCopper: 0.15,
	minPluginPadRingWithoutCopper: 0.2,
	minBgaPadDiameter: 0.25,
};

/**
 * SMT 标准类型
 */
export type SmtStandard = 'economy' | 'standard';

/**
 * SMT 标准配置
 */
export interface SmtStandardConfig {
	/** 标准名称 */
	name: string;
	/** 支持的焊接面 */
	solderingSides: ('top' | 'bottom' | 'both')[];
	/** 支持的层数 */
	layerCounts: number[];
	/** 支持的板厚范围 */
	thicknessRange: { min: number; max: number };
	/** 支持的尺寸范围 */
	sizeRange: { minWidth: number; maxWidth: number; minLength: number; maxLength: number };
	/** 支持的最小封装 */
	minPackage: string;
	/** 最小 IC 引脚间距(mm) */
	icPinPitchMin: number;
	/** 最小 BGA 球间距(mm) */
	bgaPitchMin: number;
}
