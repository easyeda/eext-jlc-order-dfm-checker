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
	/** 元素类型 */
	type: 'pad' | 'via' | 'line' | 'string' | 'component';
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
 */
export interface MaterialStandard {
	/** 板材名称 */
	name: string;
	/** 支持的层数 */
	layerCount: { min: number; max: number };
	/** 支持的尺寸 */
	sizeRange: { minWidth: number; maxWidth: number; minLength: number; maxLength: number };
	/** 支持的板厚 */
	thicknessRange: { min: number; max: number };
	/** 支持的外层铜厚 */
	outerCopperThickness: number[];
	/** 支持的内层铜厚 */
	innerCopperThickness?: number[];
	/** 支持的层压结构 */
	layerStackup?: string[];
	/** 支持的过孔类型 */
	viaTypes: ('through' | 'blind')[];
	/** 过孔钻孔直径范围 */
	viaHoleDiameterRange: { min: number; max: number };
	/** 过孔/焊盘最小外径 */
	minViaPadDiameter: number;
	/** 有铜槽孔最小尺寸 */
	slotWithCopperMinSize: { width: number; length: number };
	/** 无铜槽孔最小宽度 */
	slotWithoutCopperMinWidth: number;
	/** 最小线宽 */
	minTraceWidth: number;
	/** 最小线距 */
	minTraceSpacing: number;
	/** 焊盘/过孔到线最小间距 */
	minPadToLineSpacing: number;
	/** 有铜插件焊盘焊环最小宽度 */
	minPluginPadRingWithCopper: number;
	/** 无铜插件焊盘焊环最小宽度 */
	minPluginPadRingWithoutCopper: number;
	/** BGA焊盘最小直径 */
	minBgaPadDiameter: number;
	/** BGA焊盘边到线最小间距 */
	minBgaPadToLineSpacing: number;
	/** 字符最小高度 */
	minStringHeight: number;
	/** 字符最小粗细 */
	minStringWidth: number;
	/** 字符到裸铜最小间隙 */
	minStringToCopperSpacing: number;
}

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
}
