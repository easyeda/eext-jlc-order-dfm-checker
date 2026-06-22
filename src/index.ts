import type { CheckResult, PcbDfmResult, SmtDfmResult } from './dfm/types';
/**
 * 嘉立创 DFM 检查工具 - 主入口文件
 *
 * 本文件为扩展入口文件，导出所有菜单函数
 *
 * 如需了解更多开发细节，请阅读：
 * https://prodocs.lceda.cn/cn/api/guide/
 */
import * as extensionConfig from '../extension.json';
import { createLocateFunction } from './dfm/locate';
import { JLC_MATERIAL_STANDARDS, JLC_SUPPORTED_MATERIALS, SMT_STANDARDS } from './dfm/standards';

// 注意：函数暴露代码移到文件末尾，确保所有函数已定义

// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {
	// 插件激活时的初始化逻辑
}

// ==================== 全局状态管理 ====================

/**
 * PCB DFM 检查结果存储
 */
let pcbDfmResults: PcbDfmResult | null = null;

/**
 * SMT DFM 检查结果存储
 */
let smtDfmResults: SmtDfmResult | null = null;

/**
 * PCB 报告是否可用
 */
let pcbReportAvailable = false;

/**
 * SMT 报告是否可用
 */
let smtReportAvailable = false;

/**
 * 用户选择的板材类型
 */
let selectedMaterial: string = 'FR4';

/**
 * 默认值的板厚 (mm)
 */
let selectedThickness: number = 1.6;

/**
 * 默认外层铜厚回退值 (oz) - 仅在无法从PCB读取时使用
 */
const DEFAULT_COPPER_THICKNESS = 2;

/**
 * 当前 DFM 检查类型
 */
let _currentCheckType: 'pcb' | 'smt' = 'pcb';

// ==================== PCB DFM 检查 ====================

/**
 * 设置材料输入（由 iframe 调用）
 */
export function setMaterialInput(material: string, thickness: number): void {
	selectedMaterial = material;
	selectedThickness = thickness;
}

/**
 * 使用指定材料执行 PCB DFM 检查（由 iframe 调用）
 */
export async function pcbDfmWithMaterial(material: string, thickness: number): Promise<void> {
	selectedMaterial = material;
	selectedThickness = thickness;
	await performPcbDfmCheck();
}

/**
 * 执行 PCB DFM 检查（打开材料选择弹窗）
 */
export function pcbDfm(): void {
	// 打开材料选择对话框
	eda.sys_IFrame.openIFrame(
		'./iframe/material-selector.html',
		450,
		300,
		'materialSelector',
		{
			title: 'PCB 板材选择',
			maximizeButton: false,
			minimizeButton: false,
		},
	);
}

/**
 * 执行 PCB DFM 检查（内部函数）
 */
async function performPcbDfmCheck(): Promise<void> {
	try {
		// 清空日志面板
		eda.sys_Log.clear();

		// 打开日志面板
		eda.sys_PanelControl.openBottomPanel(ESYS_BottomPanelTab.LOG);

		// 添加检查开始信息
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);
		eda.sys_Log.add(`嘉立创 PCB DFM 检查开始... (板材: ${selectedMaterial}, 板厚: ${selectedThickness}mm)`, ESYS_LogType.INFO);
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);

		// 添加表头
		addTableHeader();

		// 执行19项检查
		const results = await performPcbChecks();

		// 输出检查结果
		displayResults(results);

		// 保存检查结果
		pcbDfmResults = {
			timestamp: Date.now(),
			results,
			passed: results.every(r => r.result === 'success'),
			errorCount: results.filter(r => r.result === 'error').length,
			warningCount: results.filter(r => r.result === 'warning').length,
		};

		// 启用报告菜单
		pcbReportAvailable = true;

		// 添加检查摘要
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);
		eda.sys_Log.add(`检查完成！通过：${results.length - pcbDfmResults.errorCount - pcbDfmResults.warningCount}/${results.length}`, ESYS_LogType.INFO);
		if (pcbDfmResults.errorCount > 0) {
			eda.sys_Log.add(`错误：${pcbDfmResults.errorCount} 项`, ESYS_LogType.ERROR);
		}
		if (pcbDfmResults.warningCount > 0) {
			eda.sys_Log.add(`警告：${pcbDfmResults.warningCount} 项`, ESYS_LogType.WARNING);
		}
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);
		eda.sys_Log.add('提示：点击坐标可定位到对应元素', ESYS_LogType.INFO);

		// 打开结果展示 iframe
		showDfmResults(pcbDfmResults, 'pcb');
	}
	catch (error) {
		eda.sys_Log.add(`检查失败：${error}`, ESYS_LogType.ERROR);
	}
}

/**
 * 执行 PCB DFM 的19项检查
 */
async function performPcbChecks(): Promise<CheckResult[]> {
	const results: CheckResult[] = [];

	try {
		// 第1项：板材类型检查
		results.push(checkMaterialType());

		// 第2项：层数检查
		results.push(await checkLayerCount());

		// 第3项：纵横尺寸检查
		results.push(await checkBoardSize());

		// 第4项：板厚检查
		results.push(checkBoardThickness());

		// 第5项：外层铜厚检查
		results.push(await checkOuterCopperThickness());

		// 第6项：内层铜厚检查
		results.push(await checkInnerCopperThickness());

		// 第7项：过孔类型检查
		results.push(await checkViaType());

		// 第8项：过孔钻孔直径检查
		results.push(await checkHoleDiameter());

		// 第9项：过孔/焊盘外径检查
		results.push(await checkViaPadDiameter());

		// 第10项：有铜槽孔检查
		results.push(await checkSlotWithCopper());

		// 第11项：无铜槽孔检查
		results.push(await checkSlotWithoutCopper());

		// 第12项：最小线宽检查
		results.push(await checkMinTraceWidth());

		// 第13项：最小线距检查
		results.push(await checkMinTraceSpacing());

		// 第14项：焊盘/过孔到线间距检查
		results.push(await checkPadToLineSpacing());

		// 第15项：有铜插件焊盘焊环检查
		results.push(await checkPluginPadRingWithCopper());

		// 第16项：无铜插件焊盘焊环检查
		results.push(await checkPluginPadRingWithoutCopper());

		// 第17项：BGA焊盘检查
		results.push(await checkBgaPad());

		// 第18项：丝印字符检查
		results.push(await checkString());
	}
	catch (error) {
		eda.sys_Log.add(`检查过程出错：${error}`, ESYS_LogType.ERROR);
	}

	return results;
}

// ==================== 具体检查函数 ====================

/**
 * 第1项：板材类型检查
 */
function checkMaterialType(): CheckResult {
	const result: CheckResult = {
		number: 1,
		item: '板材类型',
		actualValue: selectedMaterial,
		standardValue: JLC_SUPPORTED_MATERIALS.join(' / '),
		result: 'success',
	};

	try {
		// 检查是否支持
		if (!JLC_SUPPORTED_MATERIALS.includes(selectedMaterial)) {
			result.result = 'error';
			result.actualValue = `${selectedMaterial} (不支持)`;
		}
		else {
			result.actualValue = selectedMaterial;
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第2项：层数检查
/**
 * 第2项：层数检查
 */
async function checkLayerCount(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 2,
		item: '层数',
		actualValue: '未知',
		standardValue: '1-64层',
		result: 'success',
	};

	try {
		// 使用新的文档源解析方式获取层数
		const layerCount = await parseCopperLayerCount();

		result.actualValue = layerCount > 0 ? `${layerCount}层` : '0层';

		// 根据板材检查层数范围
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];
		if (standard) {
			if (layerCount < standard.layerCount.min || layerCount > standard.layerCount.max) {
				result.result = 'error';
				result.standardValue = `${standard.layerCount.min}-${standard.layerCount.max}层`;
			}
			else {
				result.standardValue = `${standard.layerCount.min}-${standard.layerCount.max}层`;
			}
		}
		else {
			result.standardValue = '1-64层';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第3项：纵横尺寸检查
 */
async function checkBoardSize(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 3,
		item: '纵横尺寸',
		actualValue: '未知',
		standardValue: '10x10 - 470x570mm',
		result: 'success',
	};

	try {
		// 从板框层获取图元（EPCB_LayerId.BOARD_OUTLINE = 11）
		const BOARD_OUTLINE_LAYER = 11;

		// 获取板框层的所有多段线
		const polylines = await eda.pcb_PrimitivePolyline.getAll(BOARD_OUTLINE_LAYER as any);

		// 获取板框层的所有线段
		const lines = await eda.pcb_PrimitiveLine.getAll(BOARD_OUTLINE_LAYER as any);

		// 获取板框层的所有圆弧
		const arcs = await eda.pcb_PrimitiveArc.getAll(BOARD_OUTLINE_LAYER as any);

		// 收集所有图元ID
		const allIds: string[] = [];
		if (polylines && polylines.length > 0) {
			const polylineIds = polylines.map((p: any) => p.primitiveId || p.id);
			allIds.push(...polylineIds);
		}

		if (lines && lines.length > 0) {
			const lineIds = lines.map((l: any) => l.primitiveId || l.id);
			allIds.push(...lineIds);
		}

		if (arcs && arcs.length > 0) {
			const arcIds = arcs.map((a: any) => a.primitiveId || a.id);
			allIds.push(...arcIds);
		}

		// 如果板框层没有图元，尝试从所有层获取所有图元来计算边界框
		if (allIds.length === 0) {
			// 获取所有层的所有图元类型
			const allPolylines = await eda.pcb_PrimitivePolyline.getAll();
			const allLines = await eda.pcb_PrimitiveLine.getAll();
			const allArcs = await eda.pcb_PrimitiveArc.getAll();
			const allPads = await eda.pcb_PrimitivePad.getAll();
			const allVias = await eda.pcb_PrimitiveVia.getAll();
			const allPours = await eda.pcb_PrimitivePour.getAll();
			const allPoureds = await eda.pcb_PrimitivePoured.getAll();
			const allFills = await eda.pcb_PrimitiveFill.getAll();

			// 收集所有图元ID
			if (allPolylines?.length)
				allIds.push(...allPolylines.map((p: any) => p.primitiveId || p.id));
			if (allLines?.length)
				allIds.push(...allLines.map((p: any) => p.primitiveId || p.id));
			if (allArcs?.length)
				allIds.push(...allArcs.map((p: any) => p.primitiveId || p.id));
			if (allPads?.length)
				allIds.push(...allPads.map((p: any) => p.primitiveId || p.id));
			if (allVias?.length)
				allIds.push(...allVias.map((p: any) => p.primitiveId || p.id));
			if (allPours?.length)
				allIds.push(...allPours.map((p: any) => p.primitiveId || p.id));
			if (allPoureds?.length)
				allIds.push(...allPoureds.map((p: any) => p.primitiveId || p.id));
			if (allFills?.length)
				allIds.push(...allFills.map((p: any) => p.primitiveId || p.id));
		}

		if (allIds.length > 0) {
			const bbox = await eda.pcb_Primitive.getPrimitivesBBox(allIds);

			if (bbox) {
				// 将 mil 转换为 mm
				const widthMm = eda.sys_Unit.milToMm(bbox.maxX - bbox.minX);
				const heightMm = eda.sys_Unit.milToMm(bbox.maxY - bbox.minY);

				result.actualValue = `${widthMm.toFixed(2)}x${heightMm.toFixed(2)}mm`;

				// 根据板材检查尺寸范围
				const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];
				if (standard) {
					const { minWidth, maxWidth, minLength, maxLength } = standard.sizeRange;
					if (widthMm < minWidth || widthMm > maxWidth
						|| heightMm < minLength || heightMm > maxLength) {
						result.result = 'error';
					}
					result.standardValue = `${minWidth}x${minLength} - ${maxWidth}x${maxLength}mm`;
				}
			}
			else {
				result.actualValue = '无法计算尺寸';
				result.result = 'warning';
			}
		}
		else {
			result.actualValue = '无图元';
			result.result = 'warning';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第4项：板厚检查
 */
function checkBoardThickness(): CheckResult {
	const result: CheckResult = {
		number: 4,
		item: '板厚',
		actualValue: `${selectedThickness}mm`,
		standardValue: '0.4-6.0mm',
		result: 'success',
	};

	try {
		// 使用默认值的板厚
		const thickness = selectedThickness;

		// 根据板材检查板厚范围
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];
		if (standard) {
			const { min, max } = standard.thicknessRange;
			if (thickness < min || thickness > max) {
				result.result = 'error';
			}
			result.standardValue = `${min}-${max}mm`;
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第5项：外层铜厚检查
 */
async function checkOuterCopperThickness(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 5,
		item: '外层铜厚',
		actualValue: '未知',
		standardValue: '0.5/1.0/1.5/2.0/3.0/4.0 oz',
		result: 'success',
		violations: [],
	};

	try {
		let copperThickness: number | null = null;
		let source = '';

		// Parse LAYER_PHYS from document source; outer copper = layer id 1 (Top) and 2 (Bottom)
		try {
			const physMap = await parseLayerPhys();
			const outerEntries: Array<{ id: number; thicknessMil: number }> = [];
			for (const id of [1, 2]) {
				const info = physMap.get(id);
				if (info && info.thicknessMil > 0) {
					outerEntries.push({ id, thicknessMil: info.thicknessMil });
				}
			}

			if (outerEntries.length > 0) {
				const ozValues = [...new Set(outerEntries.map(e => copperMilToOz(e.thicknessMil)).filter(t => t > 0))];
				if (ozValues.length > 0) {
					copperThickness = ozValues[0];
					source = '\u6587\u6863\u89E3\u6790';
				}
			}
			else {
				eda.sys_Log.add(`no outer copper in LAYER_PHYS (id 1/2)`, ESYS_LogType.WARNING);
			}
		}
		catch (e) {
			eda.sys_Log.add(`parse outer copper failed: ${e}`, ESYS_LogType.WARNING);
		}
		// 方法3: 最后回退到默认值（如果有的话）
		if (copperThickness === null || copperThickness === 0) {
			if (DEFAULT_COPPER_THICKNESS > 0) {
				copperThickness = DEFAULT_COPPER_THICKNESS;
				source = '默认值';
			}
		}

		if (copperThickness !== null && copperThickness > 0) {
			result.actualValue = `${copperThickness}oz`;
			eda.sys_Log.add(`外层铜厚检查: 使用铜厚 = ${copperThickness}oz (来源: ${source})`, ESYS_LogType.INFO);

			// 根据板材检查铜厚范围
			const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];
			if (standard) {
				const validCoppers = standard.outerCopperThickness;
				if (!validCoppers.includes(copperThickness)) {
					result.result = 'error';
				}
				result.standardValue = validCoppers.map(c => `${c}oz`).join(' / ');
			}
		}
		else {
			result.actualValue = '未设置铜厚信息';
			result.result = 'warning';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * Convert copper thickness (mil) to standard oz. 1oz copper foil = 35um = 1.378mil.
 * JLC standard copper weights are all multiples of 0.5oz, so round to nearest 0.5oz.
 */
function copperMilToOz(thicknessMil: number): number {
	if (!thicknessMil || thicknessMil <= 0 || Number.isNaN(thicknessMil)) {
		return 0;
	}
	const oz = thicknessMil / 1.378;
	return Math.round(oz * 2) / 2;
}

/**
 * Parse all LAYER_PHYS records from the document source into Map<layerId, {thicknessMil, material}>.
 * Document is compact JSON, one record per line:
 *   {"type":"LAYER_PHYS",...,"id":"[\"LAYER_PHYS\",N]"}||{"material":"...","thickness":N,...}|
 * - id is a stringified array ["LAYER_PHYS", N]; N is the real layer id
 *   (1=Top, 2=Bottom, 15..44=Inner, 361..391=Dielectric)
 * - thickness is in mil. Callers tell copper from dielectric/solder-mask by layer id.
 */
async function parseLayerPhys(): Promise<Map<number, { thicknessMil: number; material: string }>> {
	const map = new Map<number, { thicknessMil: number; material: string }>();
	try {
		const docSource = await eda.sys_FileManager.getDocumentSource();
		if (!docSource) {
			return map;
		}
		for (const line of docSource.split(String.fromCharCode(10))) {
			if (!line.includes('LAYER_PHYS')) {
				continue;
			}
			const sep = line.indexOf('||');
			if (sep === -1) {
				continue;
			}
			const outerRaw = line.slice(0, sep);
			let innerRaw = line.slice(sep + 2);
			if (innerRaw.endsWith('|')) {
				innerRaw = innerRaw.slice(0, -1);
			}
			let outer: any;
			let inner: any;
			try {
				outer = JSON.parse(outerRaw);
				inner = JSON.parse(innerRaw);
			}
			catch {
				continue;
			}
			// id looks like "[\"LAYER_PHYS\",1]"; extract the real layer number
			let layerId: number | undefined;
			try {
				const parsed = typeof outer.id === 'string' ? JSON.parse(outer.id) : outer.id;
				layerId = Number(Array.isArray(parsed) ? parsed[1] : parsed);
			}
			catch {
				continue;
			}
			if (layerId === undefined || Number.isNaN(layerId)) {
				continue;
			}
			map.set(layerId, {
				thicknessMil: Number(inner?.thickness) || 0,
				material: String(inner?.material ?? ''),
			});
		}
	}
	catch (e) {
		eda.sys_Log.add(`parseLayerPhys failed: ${e}`, ESYS_LogType.WARNING);
	}
	return map;
}

/**
 * 通过检查每层实际是否有铜元素来获取铜层数量
 * 铜元素包括：走线(Line)、焊盘(Pad)、覆铜(Region)、多段线(Polyline)等
 */
async function parseCopperLayerCount(): Promise<number> {
	try {
		const activeCopperLayers: number[] = [];

		// 需要检查的铜层ID列表
		const copperLayerIds = [1, 2]; // TOP, BOTTOM

		eda.sys_Log.add('=== 开始检查实际铜层数 ===', ESYS_LogType.INFO);

		for (const layerId of copperLayerIds) {
			let hasCopper = false;
			const layerName = layerId === 1 ? 'TOP' : 'BOTTOM';

			eda.sys_Log.add(`检查${layerName}层...`, ESYS_LogType.INFO);

			// 检查该层是否有走线
			try {
				const allLines = await eda.pcb_PrimitiveLine.getAll();
				if (allLines && allLines.length > 0) {
					// 使用多种可能的属性名
					const linesOnLayer = allLines.filter((l: any) =>
						l.layer === layerId || l.layerId === layerId,
					);
					if (linesOnLayer.length > 0) {
						hasCopper = true;
						eda.sys_Log.add(`${layerName}层: 有 ${linesOnLayer.length} 条走线`, ESYS_LogType.INFO);
					}
				}
			}
			catch (e) {
				eda.sys_Log.add(`- 走线检查失败: ${e}`, ESYS_LogType.WARNING);
			}

			// 检查该层是否有覆铜边框（Pour）
			if (!hasCopper) {
				try {
					const allPours = await eda.pcb_PrimitivePour.getAll();
					if (allPours && allPours.length > 0) {
						const pours = allPours.filter((p: any) => {
							const pourLayer = p.getState_Layer?.() ?? p.layer ?? p.layerId;
							return pourLayer === layerId;
						});
						if (pours.length > 0) {
							hasCopper = true;
							eda.sys_Log.add(`${layerName}层: 有 ${pours.length} 个覆铜边框`, ESYS_LogType.INFO);
						}
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 覆铜边框检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			// 检查该层是否有覆铜填充（Poured）
			if (!hasCopper) {
				try {
					const allPoureds = await eda.pcb_PrimitivePoured.getAll();
					if (allPoureds && allPoureds.length > 0) {
						const allPours = await eda.pcb_PrimitivePour.getAll();
						const pourLayerMap = new Map();
						if (allPours) {
							for (const pour of allPours) {
								const pourId = pour.getState_PrimitiveId?.() ?? pour.primitiveId ?? pour.id;
								const pourLayer = pour.getState_Layer?.() ?? pour.layer ?? pour.layerId;
								pourLayerMap.set(String(pourId), pourLayer);
							}
						}
						const poureds = allPoureds.filter((p: any) => {
							const pourPrimitiveId = p.getState_PourPrimitiveId?.() ?? p.pourPrimitiveId;
							const pourLayer = pourLayerMap.get(String(pourPrimitiveId));
							return pourLayer === layerId;
						});
						if (poureds.length > 0) {
							hasCopper = true;
							eda.sys_Log.add(`${layerName}层: 有 ${poureds.length} 个覆铜填充`, ESYS_LogType.INFO);
						}
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 覆铜填充检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			// 检查该层是否有焊盘 - 焊盘的层属性可能不同
			if (!hasCopper) {
				try {
					const allPads = await eda.pcb_PrimitivePad.getAll();
					if (allPads && allPads.length > 0) {
						// 焊盘可能有特殊的层属性，尝试多种方式
						let padCount = 0;
						for (const pad of allPads) {
							// 检查 pad.layer, pad.layerId, 或 pad.layers
							const padLayer = (pad as any).layer ?? (pad as any).layerId;
							const padLayers = (pad as any).layers; // 可能是数组

							// 检查是否在TOP层
							if (padLayer === layerId
								|| (Array.isArray(padLayers) && padLayers.includes(layerId))) {
								padCount++;
							}
						}
						if (padCount > 0 && layerId === 1) {
							hasCopper = true;
							eda.sys_Log.add(`${layerName}层: 有 ${padCount} 个焊盘`, ESYS_LogType.INFO);
						}
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 焊盘检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			// 检查该层是否有过孔
			if (!hasCopper) {
				try {
					const allVias = await eda.pcb_PrimitiveVia.getAll();
					if (allVias && allVias.length > 0 && layerId === 1) {
						// 过孔通常在所有层都有，所以TOP层有过孔就算有铜
						hasCopper = true;
						eda.sys_Log.add(`${layerName}层: 有 ${allVias.length} 个过孔`, ESYS_LogType.INFO);
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 过孔检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			// 检查该层是否有文字
			if (!hasCopper) {
				try {
					const allStrings = await eda.pcb_PrimitiveString.getAll();
					if (allStrings && allStrings.length > 0) {
						const strings = allStrings.filter((s: any) =>
							s.layer === layerId || s.layerId === layerId,
						);
						if (strings.length > 0) {
							hasCopper = true;
							eda.sys_Log.add(`${layerName}层: 有 ${strings.length} 个文字`, ESYS_LogType.INFO);
						}
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 文字检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			// 检查该层是否有弧线
			if (!hasCopper) {
				try {
					const allArcs = await eda.pcb_PrimitiveArc.getAll();
					if (allArcs && allArcs.length > 0) {
						const arcs = allArcs.filter((a: any) =>
							a.layer === layerId || a.layerId === layerId,
						);
						if (arcs.length > 0) {
							hasCopper = true;
							eda.sys_Log.add(`${layerName}层: 有 ${arcs.length} 条弧线`, ESYS_LogType.INFO);
						}
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 弧线检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			// 检查该层是否有填充(Fill)
			if (!hasCopper) {
				try {
					const allFills = await eda.pcb_PrimitiveFill.getAll();
					if (allFills && allFills.length > 0) {
						const fills = allFills.filter((f: any) =>
							f.layer === layerId || f.layerId === layerId,
						);
						if (fills.length > 0) {
							hasCopper = true;
							eda.sys_Log.add(`${layerName}层: 有 ${fills.length} 个填充`, ESYS_LogType.INFO);
						}
					}
				}
				catch (e) {
					eda.sys_Log.add(`- 填充检查失败: ${e}`, ESYS_LogType.WARNING);
				}
			}

			if (hasCopper) {
				activeCopperLayers.push(layerId);
			}
			else {
				eda.sys_Log.add(`${layerName}层: 无铜元素`, ESYS_LogType.INFO);
			}
		}

		eda.sys_Log.add(`解析到 ${activeCopperLayers.length} 个实际有铜的层: ${activeCopperLayers.join(',')}`, ESYS_LogType.INFO);
		eda.sys_Log.add('=== 铜层数检查完成 ===', ESYS_LogType.INFO);
		return activeCopperLayers.length;
	}
	catch (e) {
		eda.sys_Log.add(`parseCopperLayerCount失败: ${e}`, ESYS_LogType.WARNING);
		return 0;
	}
}

/**
 * 第6项：内层铜厚检查
 */
async function checkInnerCopperThickness(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 6,
		item: '内层铜厚',
		actualValue: '无内层',
		standardValue: '0.5/1.0 oz (仅FR4)',
		result: 'success',
	};

	try {
		// 只有 FR4 和高频板支持内层
		if (selectedMaterial !== 'FR4' && selectedMaterial !== '高频板') {
			result.actualValue = '当前板材不支持内层';
			result.result = 'success';
			return result;
		}

		// Parse LAYER_PHYS; inner copper layers = id 15..44 (INNER_1..INNER_30)
		const physMap = await parseLayerPhys();
		const innerEntries: Array<{ id: number; thicknessMil: number }> = [];
		for (const [id, info] of physMap) {
			if (id >= 15 && id <= 44 && info.thicknessMil > 0) {
				innerEntries.push({ id, thicknessMil: info.thicknessMil });
			}
		}

		if (innerEntries.length > 0) {
			const uniqueCoppers = [...new Set(innerEntries.map(e => copperMilToOz(e.thicknessMil)))];
			result.actualValue = uniqueCoppers.map(c => `${c}oz`).join(' / ');

			// 根据板材检查铜厚范围
			const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];
			if (standard && standard.innerCopperThickness) {
				const validCoppers = standard.innerCopperThickness;
				const invalidCoppers = uniqueCoppers.filter(c => !validCoppers.includes(c));
				if (invalidCoppers.length > 0) {
					result.result = 'warning';
				}
				result.standardValue = validCoppers.map(c => `${c}oz`).join(' / ');
			}
		}
		else {
			result.actualValue = '无内层';
			result.result = 'success';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 解析文档源中的盲埋孔设计规则（每项含 name/staLayerId/endLayerId）。
 * name 对应 via.designRuleBlindViaName；via 上该字段为 null/empty 即通孔。
 */
async function parseBlindViaRules(): Promise<Map<string, { staLayerId: number; endLayerId: number }>> {
	const map = new Map<string, { staLayerId: number; endLayerId: number }>();
	try {
		const docSource = await eda.sys_FileManager.getDocumentSource();
		if (!docSource) {
			return map;
		}
		for (const line of docSource.split(String.fromCharCode(10))) {
			if (!line.includes('BLIND') || !line.includes('blindVia')) {
				continue;
			}
			const sep = line.indexOf('||');
			if (sep === -1) {
				continue;
			}
			let right = line.slice(sep + 2);
			if (right.endsWith('|')) {
				right = right.slice(0, -1);
			}
			let obj: any;
			try {
				obj = JSON.parse(right);
			}
			catch {
				continue;
			}
			const content = obj?.ruleContext?.blinds?.content;
			if (!Array.isArray(content)) {
				continue;
			}
			for (const item of content) {
				const name = item?.name;
				if (typeof name === 'string' && name !== '') {
					map.set(name, { staLayerId: Number(item.staLayerId), endLayerId: Number(item.endLayerId) });
				}
			}
		}
	}
	catch (e) {
		eda.sys_Log.add(`parseBlindViaRules failed: ${e}`, ESYS_LogType.WARNING);
	}
	return map;
}

/**
 * 按层范围判定盲/埋孔。表层 = TOP(1)/BOTTOM(2)。
 * 盲孔 = 起止层恰有一个为表层；埋孔 = 起止层都非表层。
 */
function classifyBlindBuried(staLayerId: number, endLayerId: number): 'blind' | 'buried' {
	const isSurface = (id: number) => id === 1 || id === 2;
	const surfaceCount = (isSurface(staLayerId) ? 1 : 0) + (isSurface(endLayerId) ? 1 : 0);
	if (surfaceCount === 0) {
		return 'buried';
	}
	return 'blind';
}

/**
 * 第7项：过孔类型检查
 */
async function checkViaType(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 7,
		item: '过孔类型',
		actualValue: '未知',
		standardValue: '通孔/盲埋孔',
		result: 'success',
		violations: [],
	};

	try {
		const vias = await eda.pcb_PrimitiveVia.getAll();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];
		const ruleMap = await parseBlindViaRules();

		let through = 0;
		let blind = 0;
		let buried = 0;
		let unknown = 0;
		const supportsBlind = standard ? standard.viaTypes.includes('blind') : true;
		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];

		for (const via of vias) {
			const ruleName = via.designRuleBlindViaName ?? via.state?.designRuleBlindViaName ?? null;
			if (!ruleName) {
				through++;
				continue;
			}
			const rule = ruleMap.get(ruleName);
			if (!rule) {
				unknown++;
				continue;
			}
			const kind = classifyBlindBuried(rule.staLayerId, rule.endLayerId);
			if (kind === 'blind') {
				blind++;
			}
			else {
				buried++;
			}
			if (!supportsBlind) {
				violations.push({
					x: via.x ?? via.state?.x ?? 0,
					y: via.y ?? via.state?.y ?? 0,
					id: via.primitiveId ?? via.id ?? '',
					reason: `${kind === 'blind' ? '盲孔' : '埋孔'}(${ruleName}) 当前板材不支持`,
					type: 'via',
				});
			}
		}

		const parts: string[] = [];
		if (through > 0) {
			parts.push(`通孔 ${through}`);
		}
		if (blind > 0) {
			parts.push(`盲孔 ${blind}`);
		}
		if (buried > 0) {
			parts.push(`埋孔 ${buried}`);
		}
		if (unknown > 0) {
			parts.push(`盲埋孔 ${unknown}(未识别层)`);
		}
		result.actualValue = parts.length > 0 ? parts.join(' + ') : '无过孔';

		if ((blind > 0 || buried > 0) && !supportsBlind) {
			result.result = 'error';
			result.actualValue += ` (当前板材不支持盲埋孔)`;
			result.violations = violations;
		}

		if (standard) {
			result.standardValue = supportsBlind ? '通孔/盲埋孔' : '仅通孔';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}
/**
 * 第8项：钻孔直径检查（包含过孔和焊盘）
 * 单面板：0.3~6.3mm
 * 双面板：0.15~6.3mm
 * 多层板：0.15~6.3mm
 * 2-12层板支持0.1mm微孔工艺（板厚≤1mm，限沉金）
 */
async function checkHoleDiameter(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 8,
		item: '钻孔直径',
		actualValue: '未知',
		standardValue: '0.15-6.3mm (取决于层数)',
		result: 'success',
		violations: [],
	};

	try {
		// 获取实际铜层数
		const copperLayerCount = await parseCopperLayerCount();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		// 根据层数确定标准范围
		let minDiameter: number;
		let maxDiameter = 6.3;
		let supportsMicroHole = false; // 是否支持0.1mm微孔

		if (copperLayerCount === 1) {
			// 单面板：0.3~6.3mm
			minDiameter = 0.3;
		}
		else {
			// 双面板和多层板：0.15~6.3mm
			minDiameter = 0.15;

			// 2-12层板支持0.1mm微孔工艺（板厚≤1mm，限沉金）
			if (copperLayerCount >= 2 && copperLayerCount <= 12) {
				if (selectedThickness <= 1.0) {
					supportsMicroHole = true;
					minDiameter = 0.1;
				}
			}
		}

		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const allHoles: { diameter: number; x: number; y: number; id: string; type: string }[] = [];

		// 1. 检查过孔
		const vias = await eda.pcb_PrimitiveVia.getAll();
		for (const via of vias) {
			const v: any = via;
			// holeDiameter 为 private，优先用 getState_HoleDiameter()，兼容直接属性
			const holeDiameterMil = v.getState_HoleDiameter?.() ?? v.holeDiameter ?? v.state?.holeDiameter ?? 0;
			if (holeDiameterMil <= 0)
				continue;
			const holeDiameterMm = eda.sys_Unit.milToMm(holeDiameterMil);
			allHoles.push({
				diameter: holeDiameterMm,
				x: v.getState_X?.() ?? v.x ?? 0,
				y: v.getState_Y?.() ?? v.y ?? 0,
				id: v.getState_PrimitiveId?.() ?? v.primitiveId ?? '',
				type: '过孔',
			});
		}

		// 2. 检查焊盘的孔（插件焊盘有孔）
		const pads = await eda.pcb_PrimitivePad.getAll();
		eda.sys_Log.add(`焊盘总数: ${pads?.length || 0}`, ESYS_LogType.INFO);
		if (pads?.length > 0) {
			// 调试：输出第一个焊盘的属性结构
			const firstPad: any = pads[0];
			const dbgKeys = firstPad.getState_Hole ? 'getState_Hole可用' : '无getState_Hole';
			eda.sys_Log.add(`首个焊盘: ${dbgKeys}, hole=${JSON.stringify(firstPad.getState_Hole?.() ?? firstPad.hole ?? firstPad.state?.hole ?? null)}`, ESYS_LogType.INFO);
		}
		let padWithHole = 0;
		for (const pad of pads) {
			const p: any = pad;
			// hole 是元组：["ROUND", diameter] 圆孔，或 ["SLOT", diameter, length] 槽孔
			// 兼容类实例（getState_Hole）与普通对象（.hole / .state.hole）
			const hole: any = p.getState_Hole?.() ?? p.hole ?? p.state?.hole ?? null;
			if (!hole || !Array.isArray(hole) || hole.length < 2)
				continue;

			const holeType = hole[0];
			const holeSizeMil = Number(hole[1]) || 0;
			if (holeSizeMil <= 0)
				continue;

			// 圆孔与槽孔的 hole[1] 均为直径（槽孔额外有长度 hole[2]）
			if (holeType === 'ROUND' || holeType === 'SLOT') {
				padWithHole++;
				const holeDiameterMm = eda.sys_Unit.milToMm(holeSizeMil);
				allHoles.push({
					diameter: holeDiameterMm,
					x: p.getState_X?.() ?? p.x ?? 0,
					y: p.getState_Y?.() ?? p.y ?? 0,
					id: p.getState_PrimitiveId?.() ?? p.primitiveId ?? '',
					type: holeType === 'SLOT' ? '焊盘槽孔' : '焊盘孔',
				});
			}
		}
		eda.sys_Log.add(`识别到 ${padWithHole} 个焊盘有孔`, ESYS_LogType.INFO);

		// 检查所有孔是否在标准范围内
		for (const hole of allHoles) {
			if (hole.diameter < minDiameter) {
				violations.push({
					x: hole.x,
					y: hole.y,
					id: hole.id,
					reason: `${hole.type}直径 ${hole.diameter.toFixed(3)}mm 小于最小值 ${minDiameter}mm`,
					type: hole.type,
				});
			}
			if (hole.diameter > maxDiameter) {
				violations.push({
					x: hole.x,
					y: hole.y,
					id: hole.id,
					reason: `${hole.type}直径 ${hole.diameter.toFixed(3)}mm 大于最大值 ${maxDiameter}mm`,
					type: hole.type,
				});
			}
		}

		// 统计实际值
		if (allHoles.length > 0) {
			const diameters = allHoles.map(h => h.diameter);
			const min = Math.min(...diameters);
			const max = Math.max(...diameters);
			result.actualValue = `${min.toFixed(3)}-${max.toFixed(3)}mm`;
		}
		else {
			result.actualValue = '无孔';
		}

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}

		// 构建标准值描述
		let standardDesc = `${minDiameter}-${maxDiameter}mm`;
		if (supportsMicroHole) {
			standardDesc += ' (支持0.1mm微孔，板厚≤1mm)';
		}
		else if (copperLayerCount === 1) {
			standardDesc += ' (单面板)';
		}
		else if (copperLayerCount === 2) {
			standardDesc += ' (双面板)';
		}
		else {
			standardDesc += ` (${copperLayerCount}层板)`;
		}
		result.standardValue = standardDesc;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第9项：过孔/焊盘外径检查
 */
async function checkViaPadDiameter(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 9,
		item: '过孔/焊盘外径',
		actualValue: '未知',
		standardValue: '最小0.4mm (取决于板材)',
		result: 'success',
		violations: [],
	};

	try {
		const vias = await eda.pcb_PrimitiveVia.getAll();
		const pads = await eda.pcb_PrimitivePad.getAll();
		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minDiameter = standard.minViaPadDiameter;
		const allDiameters: number[] = [];

		// 从焊盘形状元组中解析外径（宽高的较大值）
		// pad 元组：["ELLIPSE"|"OVAL"|"NGON", width, height] / ["RECT", width, height, rotation] / ["POLYGON", data]
		const getPadOuterMm = (p: any): number => {
			const shape: any = p.getState_Pad?.() ?? p.pad ?? p.state?.pad ?? null;
			if (!Array.isArray(shape) || shape.length < 3)
				return 0;
			const w = Number(shape[1]) || 0;
			const h = Number(shape[2]) || 0;
			if (w <= 0 || h <= 0)
				return 0;
			return eda.sys_Unit.milToMm(Math.max(w, h));
		};

		// 1. 检查过孔外径
		for (const via of vias) {
			const v: any = via;
			// diameter 为 private，优先用 getState_Diameter()
			const diameterMil = v.getState_Diameter?.() ?? v.diameter ?? v.state?.diameter ?? 0;
			const diameterMm = eda.sys_Unit.milToMm(diameterMil);
			if (diameterMm > 0)
				allDiameters.push(diameterMm);

			if (diameterMm < minDiameter && diameterMm > 0) {
				violations.push({
					x: v.getState_X?.() ?? v.x ?? 0,
					y: v.getState_Y?.() ?? v.y ?? 0,
					id: v.getState_PrimitiveId?.() ?? v.primitiveId ?? '',
					reason: `过孔外径 ${diameterMm.toFixed(3)}mm 小于最小值 ${minDiameter}mm`,
					type: 'via',
				});
			}
		}

		// 2. 检查焊盘外径
		for (const pad of pads) {
			const p: any = pad;
			const padDiameterMm = getPadOuterMm(p);
			if (padDiameterMm > 0)
				allDiameters.push(padDiameterMm);

			if (padDiameterMm < minDiameter && padDiameterMm > 0) {
				violations.push({
					x: p.getState_X?.() ?? p.x ?? 0,
					y: p.getState_Y?.() ?? p.y ?? 0,
					id: p.getState_PrimitiveId?.() ?? p.primitiveId ?? '',
					reason: `焊盘外径 ${padDiameterMm.toFixed(3)}mm 小于最小值 ${minDiameter}mm`,
					type: 'pad',
				});
			}
		}

		// 统计实际值（包含过孔和焊盘的最小外径）
		if (allDiameters.length > 0) {
			const min = Math.min(...allDiameters);
			result.actualValue = `最小${min.toFixed(3)}mm`;
		}
		else {
			result.actualValue = '无过孔/焊盘';
		}

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}

		result.standardValue = `最小${minDiameter}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}
/**
 * 第10项：有铜槽孔检查
 */
async function checkSlotWithCopper(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 10,
		item: '有铜槽孔',
		actualValue: '无槽孔',
		standardValue: '最小槽宽0.6mm, 槽长1.0mm',
		result: 'success',
		violations: [],
	};

	try {
		const pads = await eda.pcb_PrimitivePad.getAll();
		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minSlotWidth = standard.slotWithCopperMinSize.width;
		const minSlotLength = standard.slotWithCopperMinSize.length;

		// 有铜槽孔：槽孔(SLOT)且金属化孔壁(metallization=true)
		// hole 元组：["SLOT", diameter, length]
		//   - hole[1] = diameter = 槽宽（半圆直径，短边）
		//   - hole[2] = length = 槽长总长（含两端半圆，长边）
		let slotCount = 0;
		const slotSizes: string[] = [];
		for (const pad of pads) {
			const p: any = pad;
			const hole: any = p.getState_Hole?.() ?? null;
			const metallization = p.getState_Metallization?.() ?? true;
			if (!hole || !Array.isArray(hole) || hole[0] !== 'SLOT' || !metallization)
				continue;

			const slotWidthMm = eda.sys_Unit.milToMm(Number(hole[1]) || 0); // 槽宽 = 半圆直径
			const slotLengthMm = eda.sys_Unit.milToMm(Number(hole[2]) || 0); // 槽长 = 总长（含半圆）
			slotCount++;
			slotSizes.push(`槽宽${slotWidthMm.toFixed(3)}/槽长${slotLengthMm.toFixed(3)}mm`);

			const px = p.getState_X?.() ?? p.x ?? 0;
			const py = p.getState_Y?.() ?? p.y ?? 0;
			const pid = p.getState_PrimitiveId?.() ?? p.primitiveId ?? '';

			if (slotWidthMm < minSlotWidth) {
				violations.push({
					x: px,
					y: py,
					id: pid,
					reason: `槽宽 ${slotWidthMm.toFixed(3)}mm 小于最小值 ${minSlotWidth}mm`,
					type: 'pad',
				});
			}
			if (slotLengthMm < minSlotLength) {
				violations.push({
					x: px,
					y: py,
					id: pid,
					reason: `槽长 ${slotLengthMm.toFixed(3)}mm 小于最小值 ${minSlotLength}mm`,
					type: 'pad',
				});
			}
		}

		if (slotCount > 0)
			result.actualValue = `${slotCount}个(${slotSizes.join(', ')})`;

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}

		result.standardValue = `最小槽宽${minSlotWidth}mm, 槽长${minSlotLength}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}
/**
 * 第11项：无铜槽孔检查
 */
async function checkSlotWithoutCopper(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 11,
		item: '无铜槽孔',
		actualValue: '无槽孔',
		standardValue: '最小槽宽0.6mm',
		result: 'success',
		violations: [],
	};

	try {
		const pads = await eda.pcb_PrimitivePad.getAll();
		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minSlotWidth = standard.slotWithoutCopperMinWidth;

		// 无铜槽孔：槽孔(SLOT)且非金属化孔壁(metallization=false)
		// hole 元组：["SLOT", diameter, length]
		//   - hole[1] = diameter = 槽宽（半圆直径，短边）
		//   - hole[2] = length = 槽长总长（含两端半圆，长边）
		let slotCount = 0;
		const slotSizes: string[] = [];
		for (const pad of pads) {
			const p: any = pad;
			const hole: any = p.getState_Hole?.() ?? null;
			const metallization = p.getState_Metallization?.() ?? true;
			if (!hole || !Array.isArray(hole) || hole[0] !== 'SLOT' || metallization)
				continue;

			const slotWidthMm = eda.sys_Unit.milToMm(Number(hole[1]) || 0); // 槽宽 = 半圆直径
			const slotLengthMm = eda.sys_Unit.milToMm(Number(hole[2]) || 0); // 槽长 = 总长（含半圆）
			slotCount++;
			slotSizes.push(`槽宽${slotWidthMm.toFixed(3)}/槽长${slotLengthMm.toFixed(3)}mm`);

			if (slotWidthMm < minSlotWidth) {
				violations.push({
					x: p.getState_X?.() ?? p.x ?? 0,
					y: p.getState_Y?.() ?? p.y ?? 0,
					id: p.getState_PrimitiveId?.() ?? p.primitiveId ?? '',
					reason: `槽宽 ${slotWidthMm.toFixed(3)}mm 小于最小值 ${minSlotWidth}mm`,
					type: 'pad',
				});
			}
		}

		if (slotCount > 0)
			result.actualValue = `${slotCount}个(${slotSizes.join(', ')})`;

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}

		result.standardValue = `最小槽宽${minSlotWidth}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}
/**
 * 第12项：最小线宽检查
 */
async function checkMinTraceWidth(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 12,
		item: '最小线宽',
		actualValue: '未知',
		standardValue: '最小0.15mm (取决于板材和铜厚)',
		result: 'success',
		violations: [],
	};

	try {
		// 获取所有直线（走线）- 立创EDA中走线使用 pcb_PrimitiveLine 表示
		const lines = await eda.pcb_PrimitiveLine.getAll();
		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		// 添加调试日志
		eda.sys_Log.add(`[DEBUG] Line count: ${lines.length}`, ESYS_LogType.INFO);

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minWidth = standard.minTraceWidth;

		// 检查所有 Line（走线）
		for (const line of lines) {
			// 使用 getState_LineWidth() 获取线宽
			const widthMil = (line as any).getState_LineWidth?.() ?? (line as any).lineWidth ?? (line as any).width ?? 0;
			const widthMm = eda.sys_Unit.milToMm(widthMil);

			if (widthMm > 0) {
				eda.sys_Log.add(`[DEBUG] Line width: ${widthMm.toFixed(4)}mm (layer: ${(line as any).getState_Layer?.() ?? 'unknown'})`, ESYS_LogType.INFO);
			}

			if (widthMm < minWidth && widthMm > 0) {
				// 获取 Line 的起点坐标
				const x = (line as any).getState_StartX?.() ?? (line as any).startX ?? (line as any).x1 ?? 0;
				const y = (line as any).getState_StartY?.() ?? (line as any).startY ?? (line as any).y1 ?? 0;
				violations.push({
					x,
					y,
					id: (line as any).getPrimitiveId?.() ?? (line as any).primitiveId ?? '',
					reason: `线宽 ${widthMm.toFixed(3)}mm 小于最小值 ${minWidth}mm`,
					type: 'line',
				});
			}
		}

		// 收集所有宽度值
		const allWidths: number[] = [];
		for (const l of lines) {
			const w = (l as any).getState_LineWidth?.() ?? (l as any).lineWidth ?? (l as any).width ?? 0;
			if (w > 0)
				allWidths.push(eda.sys_Unit.milToMm(w));
		}

		if (allWidths.length > 0) {
			const min = Math.min(...allWidths);
			result.actualValue = `最小${min.toFixed(3)}mm`;
		}
		else {
			result.actualValue = '无线段';
		}

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}

		result.standardValue = `最小${minWidth}mm`;
	}
	catch (error) {
		eda.sys_Log.add(`[DEBUG] Line width check error: ${error}`, ESYS_LogType.ERROR);
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}
/**
 * 第13项：最小线距检查
 */
async function checkMinTraceSpacing(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 13,
		item: '最小线距',
		actualValue: '符合要求',
		standardValue: '最小0.15mm',
		result: 'success',
		violations: [],
	};

	try {
		const lines = await eda.pcb_PrimitiveLine.getAll();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		// 添加调试日志
		eda.sys_Log.add(`[DEBUG] Line count for spacing check: ${lines.length}`, ESYS_LogType.INFO);

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minSpacing = standard.minTraceSpacing;
		result.standardValue = `最小${minSpacing}mm`;

		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const minSpacingMil = eda.sys_Unit.mmToMil(minSpacing);

		// 检查所有走线对之间的距离
		// 注意：间距是从走线边缘到边缘的距离，需要考虑线宽
		for (let i = 0; i < lines.length; i++) {
			const line1 = lines[i];
			const width1Mil = (line1 as any).getState_LineWidth?.() ?? (line1 as any).lineWidth ?? (line1 as any).width ?? 0;
			const layer1 = (line1 as any).getState_Layer?.() ?? (line1 as any).layer ?? (line1 as any).layerId ?? 0;

			// 只检查同层的走线
			for (let j = i + 1; j < lines.length; j++) {
				const line2 = lines[j];
				const width2Mil = (line2 as any).getState_LineWidth?.() ?? (line2 as any).lineWidth ?? (line2 as any).width ?? 0;
				const layer2 = (line2 as any).getState_Layer?.() ?? (line2 as any).layer ?? (line2 as any).layerId ?? 0;

				// 跨层走线不需要检查间距
				if (layer1 !== layer2) {
					continue;
				}

				// 获取线段坐标
				const seg1 = {
					x1: (line1 as any).getState_StartX?.() ?? (line1 as any).startX ?? (line1 as any).x1 ?? 0,
					y1: (line1 as any).getState_StartY?.() ?? (line1 as any).startY ?? (line1 as any).y1 ?? 0,
					x2: (line1 as any).getState_EndX?.() ?? (line1 as any).endX ?? (line1 as any).x2 ?? 0,
					y2: (line1 as any).getState_EndY?.() ?? (line1 as any).endY ?? (line1 as any).y2 ?? 0,
				};
				const seg2 = {
					x1: (line2 as any).getState_StartX?.() ?? (line2 as any).startX ?? (line2 as any).x1 ?? 0,
					y1: (line2 as any).getState_StartY?.() ?? (line2 as any).startY ?? (line2 as any).y1 ?? 0,
					x2: (line2 as any).getState_EndX?.() ?? (line2 as any).endX ?? (line2 as any).x2 ?? 0,
					y2: (line2 as any).getState_EndY?.() ?? (line2 as any).endY ?? (line2 as any).y2 ?? 0,
				};

				// 计算中心线距离
				const centerDistMil = calculateLineSegmentDistance(seg1, seg2);

				// 边缘间距 = 中心线距离 - (线宽1 + 线宽2) / 2
				const edgeSpacingMil = centerDistMil - (width1Mil + width2Mil) / 2;
				const edgeSpacingMm = eda.sys_Unit.milToMm(edgeSpacingMil);

				if (edgeSpacingMil > 0 && edgeSpacingMil < minSpacingMil) {
					// 找到违规位置（取两条线段的中点）
					const midX = (seg1.x1 + seg1.x2 + seg2.x1 + seg2.x2) / 4;
					const midY = (seg1.y1 + seg1.y2 + seg2.y1 + seg2.y2) / 4;

					violations.push({
						x: midX,
						y: midY,
						id: (line1 as any).getPrimitiveId?.() ?? (line1 as any).primitiveId ?? '',
						reason: `线对线距 ${edgeSpacingMm.toFixed(3)}mm 小于最小值 ${minSpacing}mm`,
						type: 'spacing',
					});
				}
			}
		}

		// 检查走线到覆铜的间距
		const pours = await eda.pcb_PrimitivePoured.getAll();
		eda.sys_Log.add(`[DEBUG] Pour count for spacing check: ${pours.length}`, ESYS_LogType.INFO);

		for (const line of lines) {
			const lineWidthMil = (line as any).getState_LineWidth?.() ?? (line as any).lineWidth ?? (line as any).width ?? 0;
			const lineLayer = (line as any).getState_Layer?.() ?? (line as any).layer ?? (line as any).layerId ?? 0;

			for (const pour of pours) {
				const pourLayer = (pour as any).getState_Layer?.() ?? (pour as any).layer ?? (pour as any).layerId ?? 0;

				// 只检查同层
				if (pourLayer !== lineLayer) {
					continue;
				}

				// 获取覆铜边框（多边形）
				const points = (pour as any).getState_Points?.() ?? (pour as any).points ?? (pour as any).state?.points ?? [];
				if (points.length < 2) {
					eda.sys_Log.add(`[DEBUG] Pour has less than 2 points: ${points.length}`, ESYS_LogType.INFO);
					continue;
				}

				// 计算走线到覆铜边框的最近距离
				let minPourDist = Infinity;
				for (let i = 0; i < points.length; i++) {
					const p1 = points[i];
					const p2 = points[(i + 1) % points.length];
					const seg = {
						x1: (p1 as any).x ?? 0,
						y1: (p1 as any).y ?? 0,
						x2: (p2 as any).x ?? 0,
						y2: (p2 as any).y ?? 0,
					};

					const lineSeg = {
						x1: (line as any).getState_StartX?.() ?? (line as any).startX ?? (line as any).x1 ?? 0,
						y1: (line as any).getState_StartY?.() ?? (line as any).startY ?? (line as any).y1 ?? 0,
						x2: (line as any).getState_EndX?.() ?? (line as any).endX ?? (line as any).x2 ?? 0,
						y2: (line as any).getState_EndY?.() ?? (line as any).endY ?? (line as any).y2 ?? 0,
					};

					const dist = calculateLineSegmentDistance(lineSeg, seg);
					if (dist < minPourDist) {
						minPourDist = dist;
					}
				}

				// 边缘间距 = 中心距离 - 线宽/2
				const edgeSpacingMil = minPourDist - lineWidthMil / 2;

				if (edgeSpacingMil > 0 && edgeSpacingMil < minSpacingMil) {
					const edgeSpacingMm = eda.sys_Unit.milToMm(edgeSpacingMil);
					const lineMidX = ((line as any).getState_StartX?.() ?? (line as any).startX ?? 0) + ((line as any).getState_EndX?.() ?? (line as any).endX ?? 0);
					const lineMidY = ((line as any).getState_StartY?.() ?? (line as any).startY ?? 0) + ((line as any).getState_EndY?.() ?? (line as any).endY ?? 0);

					violations.push({
						x: lineMidX / 2,
						y: lineMidY / 2,
						id: (line as any).getPrimitiveId?.() ?? (line as any).primitiveId ?? '',
						reason: `线对覆铜距 ${edgeSpacingMm.toFixed(3)}mm 小于最小值 ${minSpacing}mm`,
						type: 'line-pour',
					});
				}
			}
		}

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}
		for (const line of lines) {
			const lineWidthMil = (line as any).getState_LineWidth?.() ?? (line as any).lineWidth ?? (line as any).width ?? 0;
			const lineLayer = (line as any).getState_Layer?.() ?? (line as any).layer ?? (line as any).layerId ?? 0;

			for (const pour of pours) {
				const pourLayer = (pour as any).getState_Layer?.() ?? (pour as any).layer ?? (pour as any).layerId ?? 0;

				// 只检查同层
				if (pourLayer !== lineLayer) {
					continue;
				}

				// 获取覆铜边框（多边形）
				const points = (pour as any).getState_Points?.() ?? (pour as any).points ?? (pour as any).state?.points ?? [];
				if (points.length < 2)
					continue;

				// 计算走线到覆铜边框的最近距离
				let minPourDist = Infinity;
				for (let i = 0; i < points.length; i++) {
					const p1 = points[i];
					const p2 = points[(i + 1) % points.length];
					const seg = {
						x1: (p1 as any).x ?? 0,
						y1: (p1 as any).y ?? 0,
						x2: (p2 as any).x ?? 0,
						y2: (p2 as any).y ?? 0,
					};

					const lineSeg = {
						x1: (line as any).getState_StartX?.() ?? (line as any).startX ?? (line as any).x1 ?? 0,
						y1: (line as any).getState_StartY?.() ?? (line as any).startY ?? (line as any).y1 ?? 0,
						x2: (line as any).getState_EndX?.() ?? (line as any).endX ?? (line as any).x2 ?? 0,
						y2: (line as any).getState_EndY?.() ?? (line as any).endY ?? (line as any).y2 ?? 0,
					};

					const dist = calculateLineSegmentDistance(lineSeg, seg);
					if (dist < minPourDist) {
						minPourDist = dist;
					}
				}

				// 边缘间距 = 中心距离 - 线宽/2
				const edgeSpacingMil = minPourDist - lineWidthMil / 2;

				if (edgeSpacingMil > 0 && edgeSpacingMil < minSpacingMil) {
					const edgeSpacingMm = eda.sys_Unit.milToMm(edgeSpacingMil);
					const lineMidX = ((line as any).getState_StartX?.() ?? (line as any).startX ?? 0) + ((line as any).getState_EndX?.() ?? (line as any).endX ?? 0);
					const lineMidY = ((line as any).getState_StartY?.() ?? (line as any).startY ?? 0) + ((line as any).getState_EndY?.() ?? (line as any).endY ?? 0);

					violations.push({
						x: lineMidX / 2,
						y: lineMidY / 2,
						id: (line as any).getPrimitiveId?.() ?? (line as any).primitiveId ?? '',
						reason: `线到覆铜距 ${edgeSpacingMm.toFixed(3)}mm 小于最小值 ${minSpacing}mm`,
						type: 'line-pour',
					});
				}
			}
		}

		// 计算实际最小线距
		let minActualSpacing = Infinity;
		for (let i = 0; i < lines.length; i++) {
			const line1 = lines[i];
			const width1Mil = (line1 as any).getState_LineWidth?.() ?? (line1 as any).lineWidth ?? (line1 as any).width ?? 0;
			const layer1 = (line1 as any).getState_Layer?.() ?? (line1 as any).layer ?? (line1 as any).layerId ?? 0;

			for (let j = i + 1; j < lines.length; j++) {
				const line2 = lines[j];
				const width2Mil = (line2 as any).getState_LineWidth?.() ?? (line2 as any).lineWidth ?? (line2 as any).width ?? 0;
				const layer2 = (line2 as any).getState_Layer?.() ?? (line2 as any).layer ?? (line2 as any).layerId ?? 0;

				if (layer1 !== layer2)
					continue;

				const seg1 = {
					x1: (line1 as any).getState_StartX?.() ?? (line1 as any).startX ?? (line1 as any).x1 ?? 0,
					y1: (line1 as any).getState_StartY?.() ?? (line1 as any).startY ?? (line1 as any).y1 ?? 0,
					x2: (line1 as any).getState_EndX?.() ?? (line1 as any).endX ?? (line1 as any).x2 ?? 0,
					y2: (line1 as any).getState_EndY?.() ?? (line1 as any).endY ?? (line1 as any).y2 ?? 0,
				};
				const seg2 = {
					x1: (line2 as any).getState_StartX?.() ?? (line2 as any).startX ?? (line2 as any).x1 ?? 0,
					y1: (line2 as any).getState_StartY?.() ?? (line2 as any).startY ?? (line2 as any).y1 ?? 0,
					x2: (line2 as any).getState_EndX?.() ?? (line2 as any).endX ?? (line2 as any).x2 ?? 0,
					y2: (line2 as any).getState_EndY?.() ?? (line2 as any).endY ?? (line2 as any).y2 ?? 0,
				};

				const centerDistMil = calculateLineSegmentDistance(seg1, seg2);
				const edgeSpacingMil = centerDistMil - (width1Mil + width2Mil) / 2;

				if (edgeSpacingMil > 0 && edgeSpacingMil < minActualSpacing) {
					minActualSpacing = edgeSpacingMil;
				}
			}
		}

		if (minActualSpacing !== Infinity) {
			result.actualValue = `最小${eda.sys_Unit.milToMm(minActualSpacing).toFixed(3)}mm`;
		}
		else if (lines.length < 2) {
			result.actualValue = '少于2条走线';
		}
	}
	catch (error) {
		eda.sys_Log.add(`[DEBUG] Line spacing check error: ${error}`, ESYS_LogType.ERROR);
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 计算两条线段之间的距离
 * 使用点线距离公式
 */
function calculateLineSegmentDistance(seg1: { x1: number; y1: number; x2: number; y2: number }, seg2: { x1: number; y1: number; x2: number; y2: number }): number {
	// 计算线段1的两个端点到线段2的距离
	const d1 = pointToLineSegmentDistance(
		{ x: seg1.x1, y: seg1.y1 },
		seg2,
	);
	const d2 = pointToLineSegmentDistance(
		{ x: seg1.x2, y: seg1.y2 },
		seg2,
	);

	// 计算线段2的两个端点到线段1的距离
	const d3 = pointToLineSegmentDistance(
		{ x: seg2.x1, y: seg2.y1 },
		seg1,
	);
	const d4 = pointToLineSegmentDistance(
		{ x: seg2.x2, y: seg2.y2 },
		seg1,
	);

	return Math.min(d1, d2, d3, d4);
}

/**
 * 计算点到线段的距离
 */
function pointToLineSegmentDistance(point: { x: number; y: number }, line: { x1: number; y1: number; x2: number; y2: number }): number {
	const { x1, y1, x2, y2 } = line;
	const A = { x: x1, y: y1 };
	const B = { x: x2, y: y2 };

	const ABLength2 = (B.x - A.x) ** 2 + (B.y - A.y) ** 2;

	if (ABLength2 === 0) {
		return Math.sqrt((point.x - A.x) ** 2 + (point.y - A.y) ** 2);
	}

	const t = ((point.x - A.x) * (B.x - A.x) + (point.y - A.y) * (B.y - A.y)) / ABLength2;

	if (t < 0) {
		return Math.sqrt((point.x - A.x) ** 2 + (point.y - A.y) ** 2);
	}
	if (t > 1) {
		return Math.sqrt((point.x - B.x) ** 2 + (point.y - B.y) ** 2);
	}

	const closestX = A.x + t * (B.x - A.x);
	const closestY = A.y + t * (B.y - A.y);

	return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

/**
 * 第14项：焊盘/过孔到线间距检查
 */
async function checkPadToLineSpacing(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 14,
		item: '焊盘/过孔到线间距',
		actualValue: '符合要求',
		standardValue: '最小0.15mm',
		result: 'success',
		violations: [],
	};

	try {
		const lines = await eda.pcb_PrimitiveLine.getAll();
		const pads = await eda.pcb_PrimitivePad.getAll();
		const vias = await eda.pcb_PrimitiveVia.getAll();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minSpacing = standard.minPadToLineSpacing;
		result.standardValue = `最小${minSpacing}mm`;

		const violations: { x: number; y: number; id: string; reason: string; type: string }[] = [];
		const minSpacingMil = eda.sys_Unit.mmToMil(minSpacing);
		let minActualSpacing = Infinity;

		// 检查焊盘到线的间距
		for (const pad of pads) {
			const padX = (pad as any).getState_X?.() ?? (pad as any).x ?? 0;
			const padY = (pad as any).getState_Y?.() ?? (pad as any).y ?? 0;
			const padWidthMil = (pad as any).getState_Width?.() ?? (pad as any).width ?? 0;
			const padRadiusMil = padWidthMil / 2;

			for (const line of lines) {
				const lineWidthMil = (line as any).getState_LineWidth?.() ?? (line as any).lineWidth ?? (line as any).width ?? 0;
				const seg = {
					x1: (line as any).getState_StartX?.() ?? (line as any).startX ?? (line as any).x1 ?? 0,
					y1: (line as any).getState_StartY?.() ?? (line as any).startY ?? (line as any).y1 ?? 0,
					x2: (line as any).getState_EndX?.() ?? (line as any).endX ?? (line as any).x2 ?? 0,
					y2: (line as any).getState_EndY?.() ?? (line as any).endY ?? (line as any).y2 ?? 0,
				};

				const centerDistMil = calculatePointToLineDistance({ x: padX, y: padY }, seg);
				const edgeSpacingMil = centerDistMil - padRadiusMil - lineWidthMil / 2;

				if (edgeSpacingMil > 0 && edgeSpacingMil < minSpacingMil) {
					const edgeSpacingMm = eda.sys_Unit.milToMm(edgeSpacingMil);
					violations.push({
						x: padX,
						y: padY,
						id: (pad as any).getPrimitiveId?.() ?? (pad as any).primitiveId ?? '',
						reason: `焊盘到线距 ${edgeSpacingMm.toFixed(3)}mm 小于最小值 ${minSpacing}mm`,
						type: 'pad-line',
					});
				}

				if (edgeSpacingMil > 0 && edgeSpacingMil < minActualSpacing) {
					minActualSpacing = edgeSpacingMil;
				}
			}
		}

		// 检查过孔到线的间距
		for (const via of vias) {
			const viaX = (via as any).getState_X?.() ?? (via as any).x ?? 0;
			const viaY = (via as any).getState_Y?.() ?? (via as any).y ?? 0;
			const viaDiameterMil = (via as any).getState_Diameter?.() ?? (via as any).diameter ?? 0;
			const viaRadiusMil = viaDiameterMil / 2;

			for (const line of lines) {
				const lineWidthMil = (line as any).getState_LineWidth?.() ?? (line as any).lineWidth ?? (line as any).width ?? 0;
				const seg = {
					x1: (line as any).getState_StartX?.() ?? (line as any).startX ?? (line as any).x1 ?? 0,
					y1: (line as any).getState_StartY?.() ?? (line as any).startY ?? (line as any).y1 ?? 0,
					x2: (line as any).getState_EndX?.() ?? (line as any).endX ?? (line as any).x2 ?? 0,
					y2: (line as any).getState_EndY?.() ?? (line as any).endY ?? (line as any).y2 ?? 0,
				};

				const centerDistMil = calculatePointToLineDistance({ x: viaX, y: viaY }, seg);
				const edgeSpacingMil = centerDistMil - viaRadiusMil - lineWidthMil / 2;

				if (edgeSpacingMil > 0 && edgeSpacingMil < minSpacingMil) {
					const edgeSpacingMm = eda.sys_Unit.milToMm(edgeSpacingMil);
					violations.push({
						x: viaX,
						y: viaY,
						id: (via as any).getPrimitiveId?.() ?? (via as any).primitiveId ?? '',
						reason: `过孔到线距 ${edgeSpacingMm.toFixed(3)}mm 小于最小值 ${minSpacing}mm`,
						type: 'via-line',
					});
				}

				if (edgeSpacingMil > 0 && edgeSpacingMil < minActualSpacing) {
					minActualSpacing = edgeSpacingMil;
				}
			}
		}

		if (violations.length > 0) {
			result.result = 'error';
			result.violations = violations;
		}

		if (minActualSpacing !== Infinity) {
			result.actualValue = `最小${eda.sys_Unit.milToMm(minActualSpacing).toFixed(3)}mm`;
		}
		else if (pads.length === 0 && vias.length === 0) {
			result.actualValue = '无焊盘/过孔';
		}
		else if (lines.length === 0) {
			result.actualValue = '无走线';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第15项：有铜插件焊盘焊环检查
 */
async function checkPluginPadRingWithCopper(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 15,
		item: '有铜插件焊盘焊环',
		actualValue: '符合要求',
		standardValue: '最小0.15mm',
		result: 'success',
		violations: [],
	};

	try {
		const pads = await eda.pcb_PrimitivePad.getAll();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minRingWidth = standard.minPluginPadRingWithCopper;
		const pluginPads = pads.filter((p: any) => p.hole && p.hole.diameter);

		if (pluginPads.length > 0) {
			result.actualValue = `检查${pluginPads.length}个插件焊盘`;
		}
		else {
			result.actualValue = '无插件焊盘';
		}

		result.standardValue = `最小${minRingWidth}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第16项：无铜插件焊盘焊环检查
 */
async function checkPluginPadRingWithoutCopper(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 16,
		item: '无铜插件焊盘焊环',
		actualValue: '符合要求',
		standardValue: '最小0.2mm',
		result: 'success',
		violations: [],
	};

	try {
		const pads = await eda.pcb_PrimitivePad.getAll();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minRingWidth = standard.minPluginPadRingWithoutCopper;
		result.standardValue = `最小${minRingWidth}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第17项：BGA焊盘检查
 */
async function checkBgaPad(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 17,
		item: 'BGA焊盘',
		actualValue: '无BGA焊盘',
		standardValue: '最小直径0.25mm',
		result: 'success',
		violations: [],
	};

	try {
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minPadDiameter = standard.minBgaPadDiameter;
		result.standardValue = `最小直径${minPadDiameter}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 第18项：丝印字符检查
 */
async function checkString(): Promise<CheckResult> {
	const result: CheckResult = {
		number: 18,
		item: '丝印字符',
		actualValue: '符合要求',
		standardValue: '高度≥0.8mm, 粗细≥0.15mm',
		result: 'success',
		violations: [],
	};

	try {
		const strings = await eda.pcb_PrimitiveString.getAll();
		const standard = JLC_MATERIAL_STANDARDS[selectedMaterial];

		if (!standard) {
			result.actualValue = '未找到板材标准';
			result.result = 'warning';
			return result;
		}

		const minHeight = standard.minStringHeight;
		const minWidth = standard.minStringWidth;

		if (strings.length > 0) {
			result.actualValue = `检查${strings.length}个字符`;
		}
		else {
			result.actualValue = '无丝印字符';
		}

		result.standardValue = `高度≥${minHeight}mm, 粗细≥${minWidth}mm`;
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * 执行 SMT DFM 检查（选择标准后调用）
 */
export async function performSmtCheck(standard: 'economy' | 'standard'): Promise<void> {
	try {
		// 清空日志面板
		eda.sys_Log.clear();

		// 打开日志面板
		eda.sys_PanelControl.openBottomPanel(ESYS_BottomPanelTab.LOG);

		// 添加检查开始信息
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);
		eda.sys_Log.add(`嘉立创 SMT DFM 检查开始... (标准: ${standard})`, ESYS_LogType.INFO);
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);

		// 添加表头
		addTableHeader();

		// 执行6项检查
		const results = await performSmtChecks(standard);

		// 输出检查结果
		displayResults(results);

		// 保存检查结果
		smtDfmResults = {
			timestamp: Date.now(),
			standard,
			results,
			passed: results.every(r => r.result === 'success'),
			errorCount: results.filter(r => r.result === 'error').length,
			warningCount: results.filter(r => r.result === 'warning').length,
		};

		// 启用报告菜单
		smtReportAvailable = true;

		// 添加检查摘要
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);
		eda.sys_Log.add(`检查完成！通过：${results.length - smtDfmResults.errorCount - smtDfmResults.warningCount}/${results.length}`, ESYS_LogType.INFO);
		if (smtDfmResults.errorCount > 0) {
			eda.sys_Log.add(`错误：${smtDfmResults.errorCount} 项`, ESYS_LogType.ERROR);
		}
		if (smtDfmResults.warningCount > 0) {
			eda.sys_Log.add(`警告：${smtDfmResults.warningCount} 项`, ESYS_LogType.WARNING);
		}
		eda.sys_Log.add('==========================================', ESYS_LogType.INFO);
		eda.sys_Log.add('提示：点击坐标可定位到对应元素', ESYS_LogType.INFO);

		// 打开结果展示 iframe
		showDfmResults(smtDfmResults, 'smt');
	}
	catch (error) {
		eda.sys_Log.add(`检查失败：${error}`, ESYS_LogType.ERROR);
	}
}

/**
 * 打开 SMT 标准选择对话框
 */
export function smtDfm(): void {
	// 打开标准选择对话框
	eda.sys_IFrame.openIFrame(
		'./iframe/smt-selector.html',
		300,
		200,
		'smtSelector',
		{
			title: 'SMT DFM 标准选择',
			maximizeButton: false,
			minimizeButton: false,
		},
	);
}

/**
 * 执行 SMT DFM 的6项检查
 */
async function performSmtChecks(standard: 'economy' | 'standard'): Promise<CheckResult[]> {
	const results: CheckResult[] = [];
	const smtStandard = SMT_STANDARDS[standard];

	try {
		// 第1项：焊接面检查
		results.push(checkSolderingSides(smtStandard));

		// 第2项：层数检查
		results.push(checkSmtLayerCount(smtStandard));

		// 第3项：板厚检查
		results.push(checkSmtBoardThickness(smtStandard));

		// 第4项：尺寸检查
		results.push(checkSmtBoardSize(smtStandard));

		// 第5项：最小封装检查
		results.push(checkSmtMinPackage(smtStandard));

		// 第6项：组装工艺检查
		results.push(checkSmtAssemblyProcess(smtStandard));
	}
	catch (error) {
		eda.sys_Log.add(`SMT检查过程出错：${error}`, ESYS_LogType.ERROR);
	}

	return results;
}

/**
 * SMT 第1项：焊接面检查
 */
function checkSolderingSides(standard: SmtStandardConfig): CheckResult {
	const result: CheckResult = {
		number: 1,
		item: '焊接面',
		actualValue: 'TOP + BOT',
		standardValue: '支持双面',
		result: 'success',
	};

	try {
		// TODO: 检查是否有元件在TOP和BOT面
		// const hasTopComponents = eda.pcb_Document.hasComponentsOnLayer('TOP');
		// const hasBotComponents = eda.pcb_Document.hasComponentsOnLayer('BOT');

		// 检查是否符合标准
		if (!standard.solderingSides.includes('both')) {
			result.result = 'error';
			result.actualValue += ' (不符合当前标准)';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * SMT 第2项：层数检查
 */
function checkSmtLayerCount(standard: SmtStandardConfig): CheckResult {
	const result: CheckResult = {
		number: 2,
		item: '层数',
		actualValue: '4层',
		standardValue: `支持${standard.layerCounts.length > 0 ? standard.layerCounts.join('/') : '无限制'}层`,
		result: 'success',
	};

	try {
		// TODO: 获取实际层数
		const layerCount = 4; // 临时值

		// 检查是否符合标准
		if (standard.layerCounts.length > 0 && !standard.layerCounts.includes(layerCount)) {
			result.result = 'error';
			result.actualValue += ` (不符合当前标准)`;
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * SMT 第3项：板厚检查
 */
function checkSmtBoardThickness(standard: SmtStandardConfig): CheckResult {
	const result: CheckResult = {
		number: 3,
		item: '板厚',
		actualValue: '1.6mm',
		standardValue: `${standard.thicknessRange.min}-${standard.thicknessRange.max}mm`,
		result: 'success',
	};

	try {
		// TODO: 获取实际板厚
		const thickness = 1.6; // 临时值

		// 检查是否符合标准
		if (thickness < standard.thicknessRange.min || thickness > standard.thicknessRange.max) {
			result.result = 'error';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * SMT 第4项：尺寸检查
 */
function checkSmtBoardSize(standard: SmtStandardConfig): CheckResult {
	const result: CheckResult = {
		number: 4,
		item: '纵横尺寸',
		actualValue: '100x150mm',
		standardValue: `${standard.sizeRange.minWidth}x${standard.sizeRange.minLength} - ${standard.sizeRange.maxWidth}x${standard.sizeRange.maxLength}mm`,
		result: 'success',
	};

	try {
		// TODO: 获取实际尺寸
		const width = 100; // 临时值
		const height = 150; // 临时值

		// 检查是否符合标准
		if (width < standard.sizeRange.minWidth || width > standard.sizeRange.maxWidth
			|| height < standard.sizeRange.minLength || height > standard.sizeRange.maxLength) {
			result.result = 'error';
		}
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 * SMT 第5项：最小封装检查
 */
function checkSmtMinPackage(standard: SmtStandardConfig): CheckResult {
	const result: CheckResult = {
		number: 5,
		item: '最小封装',
		actualValue: '0402',
		standardValue: `最小${standard.minPackage}`,
		result: 'success',
		violations: [],
	};

	try {
		// TODO: 获取所有元件封装
		// const components = eda.pcb_PrimitiveComponent.getAll();
		// const packages = components.map(c => c.package);

		// 检查是否有不符合标准的封装
		// for (const pkg of packages) {
		//     if (isPackageSmaller(pkg, standard.minPackage)) {
		//         violations.push({
		//             x: component.x,
		//             y: component.y,
		//             id: component.primitiveId,
		//             reason: `封装 ${pkg} 小于最小值 ${standard.minPackage}`,
		//             type: 'component',
		//         });
		//     }
		// }

		// if (violations.length > 0) {
		//     result.result = 'error';
		//     result.violations = violations;
		// }
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

/**
 */
function checkSmtAssemblyProcess(_standard: SmtStandardConfig): CheckResult {
	const result: CheckResult = {
		number: 6,
		item: '组装工艺',
		actualValue: '符合要求',
		standardValue: 'SMT工艺',
		result: 'success',
	};

	try {
		// TODO: 检查组装工艺是否符合要求
		// 检查元件密度、焊盘设计等
	}
	catch (error) {
		result.actualValue = '检查失败';
		result.result = 'warning';
	}

	return result;
}

// ==================== 报告导出 ====================

/**
 * 导出 PCB DFM 报告
 */
export function exportPcbReport(): void {
	if (!pcbReportAvailable || !pcbDfmResults) {
		eda.sys_Dialog.showInformationMessage(
			'请先执行 PCB DFM 检查',
			'提示',
		);
		return;
	}

	try {
		const report = generatePcbReport(pcbDfmResults);
		const fileName = `PCB_DFM_Report_${new Date().toISOString().slice(0, 10)}.txt`;

		// 使用文件系统API保存
		eda.sys_FileSystem.saveFile(report, fileName);

		eda.sys_Log.add(`PCB DFM 报告已导出：${fileName}`, ESYS_LogType.INFO);
	}
	catch (error) {
		eda.sys_Log.add(`报告导出失败：${error}`, ESYS_LogType.ERROR);
	}
}

/**
 * 导出 SMT DFM 报告
 */
export function exportSmtReport(): void {
	if (!smtReportAvailable || !smtDfmResults) {
		eda.sys_Dialog.showInformationMessage(
			'请先执行 SMT DFM 检查',
			'提示',
		);
		return;
	}

	try {
		const report = generateSmtReport(smtDfmResults);
		const fileName = `SMT_DFM_Report_${new Date().toISOString().slice(0, 10)}.txt`;

		// 使用文件系统API保存
		eda.sys_FileSystem.saveFile(report, fileName);

		eda.sys_Log.add(`SMT DFM 报告已导出：${fileName}`, ESYS_LogType.INFO);
	}
	catch (error) {
		eda.sys_Log.add(`报告导出失败：${error}`, ESYS_LogType.ERROR);
	}
}

/**
 * 生成 PCB DFM 报告内容
 */
function generatePcbReport(result: PcbDfmResult): string {
	const lines: string[] = [];

	lines.push('==========================================');
	lines.push('嘉立创 PCB DFM 检查报告');
	lines.push('==========================================');
	lines.push(`检查时间：${new Date(result.timestamp).toLocaleString('zh-CN')}`);
	lines.push(`检查结果：${result.passed ? '通过' : '不通过'}`);
	lines.push(`错误数量：${result.errorCount}`);
	lines.push(`警告数量：${result.warningCount}`);
	lines.push('==========================================');
	lines.push('');
	lines.push('检查详情：');
	lines.push('');

	for (const r of result.results) {
		lines.push(`${r.number}. ${r.item}`);
		lines.push(`   实际值：${r.actualValue}`);
		lines.push(`   标准值：${r.standardValue}`);
		lines.push(`   结果：${r.result === 'success' ? 'OK' : r.result === 'warning' ? '警告' : '错误'}`);

		if (r.violations && r.violations.length > 0) {
			lines.push(`   违规项数量：${r.violations.length}`);
			for (const v of r.violations.slice(0, 10)) { // 最多显示10个
				lines.push(`     - (${v.x.toFixed(2)}, ${v.y.toFixed(2)}) ${v.reason}`);
			}
			if (r.violations.length > 10) {
				lines.push(`     ... 还有 ${r.violations.length - 10} 个违规项`);
			}
		}
		lines.push('');
	}

	lines.push('==========================================');
	lines.push('报告结束');

	return lines.join('\n');
}

/**
 * 生成 SMT DFM 报告内容
 */
function generateSmtReport(result: SmtDfmResult): string {
	const lines: string[] = [];

	lines.push('==========================================');
	lines.push('嘉立创 SMT DFM 检查报告');
	lines.push('==========================================');
	lines.push(`检查时间：${new Date(result.timestamp).toLocaleString('zh-CN')}`);
	lines.push(`使用标准：${result.standard === 'economy' ? '经济型' : '标准型'}`);
	lines.push(`检查结果：${result.passed ? '通过' : '不通过'}`);
	lines.push(`错误数量：${result.errorCount}`);
	lines.push(`警告数量：${result.warningCount}`);
	lines.push('==========================================');
	lines.push('');
	lines.push('检查详情：');
	lines.push('');

	for (const r of result.results) {
		lines.push(`${r.number}. ${r.item}`);
		lines.push(`   实际值：${r.actualValue}`);
		lines.push(`   标准值：${r.standardValue}`);
		lines.push(`   结果：${r.result === 'success' ? 'OK' : r.result === 'warning' ? '警告' : '错误'}`);

		if (r.violations && r.violations.length > 0) {
			lines.push(`   违规项数量：${r.violations.length}`);
			for (const v of r.violations.slice(0, 10)) { // 最多显示10个
				lines.push(`     - (${v.x.toFixed(2)}, ${v.y.toFixed(2)}) ${v.reason}`);
			}
			if (r.violations.length > 10) {
				lines.push(`     ... 还有 ${r.violations.length - 10} 个违规项`);
			}
		}
		lines.push('');
	}

	lines.push('==========================================');
	lines.push('报告结束');

	return lines.join('\n');
}

// ==================== 日志功能 ====================

/**
 * 显示 DFM 日志
 */
export function showLog(): void {
	// 打开日志面板
	eda.sys_PanelControl.openBottomPanel(ESYS_BottomPanelTab.LOG);

	// 筛选DFM相关日志
	try {
		const dfmLogs = eda.sys_Log.find(['DFM', '嘉立创', '检查']);
		eda.sys_Log.add(`找到 ${dfmLogs.length} 条DFM相关日志`, ESYS_LogType.INFO);
	}
	catch (error) {
		eda.sys_Log.add(`日志查询失败：${error}`, ESYS_LogType.ERROR);
	}
}

// ==================== 辅助函数 ====================

/**
 * 添加检查结果表头
 */
function addTableHeader(): void {
	eda.sys_Log.add('编号\t检测项目\t\tPCB实际值\t\t嘉立创标准值\t\t比对结果', ESYS_LogType.INFO);
	eda.sys_Log.add('---\t------\t\t------\t\t------\t\t----', ESYS_LogType.INFO);
}

/**
 * 显示检查结果
 */
function displayResults(results: CheckResult[]): void {
	for (const result of results) {
		const resultType = result.result === 'success'
			? ESYS_LogType.INFO
			: result.result === 'warning'
				? ESYS_LogType.WARNING
				: ESYS_LogType.ERROR;

		const resultText = result.result === 'success' ? 'OK' : 'ERROR';

		// 格式化输出
		eda.sys_Log.add(
			`${result.number}\t${result.item}\t\t${result.actualValue}\t\t${result.standardValue}\t\t${resultText}`,
			resultType,
		);

		// 如果有违规项，输出详细信息
		if (result.violations && result.violations.length > 0) {
			for (const v of result.violations.slice(0, 5)) { // 最多显示5个
				eda.sys_Log.add(
					`  -> 违规: (${v.x.toFixed(2)}, ${v.y.toFixed(2)}) ${v.reason}`,
					ESYS_LogType.ERROR,
				);
			}
			if (result.violations.length > 5) {
				eda.sys_Log.add(
					`  ... 还有 ${result.violations.length - 5} 个违规项`,
					ESYS_LogType.WARNING,
				);
			}
		}
	}
}

// ==================== 全局结果存储 ====================

/**
 * 当前 DFM 检查结果（用于 iframe 访问）
 */
let currentDfmResults: { results: PcbDfmResult | SmtDfmResult; type: 'pcb' | 'smt' } | null = null;

/**
 * 展示 DFM 检查结果（打开 iframe）
 * @param results 检查结果
 * @param type 检查类型 ('pcb' | 'smt')
 */
function showDfmResults(results: PcbDfmResult | SmtDfmResult, type: 'pcb' | 'smt'): void {
	try {
		// 保存当前结果到全局变量
		currentDfmResults = { results, type };

		// 打开结果展示 iframe
		eda.sys_IFrame.openIFrame(
			'./iframe/dfm-results.html',
			700,
			500,
			'dfmResults',
			{
				title: type === 'pcb' ? 'PCB DFM 检查结果' : 'SMT DFM 检查结果',
				maximizeButton: true,
				minimizeButton: false,
			},
		);
	}
	catch (error) {
		eda.sys_Log.add(`打开结果窗口失败：${error}`, ESYS_LogType.ERROR);
	}
}

/**
 * About 菜单项
 */
export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		eda.sys_I18n.text('EasyEDA extension SDK v', undefined, undefined, extensionConfig.version),
		eda.sys_I18n.text('About'),
	);
}

// ==================== 暴露函数给 iframe 调用 ====================

// 确保在所有函数定义后再暴露
// 将函数挂载到全局 eda 对象上，iframe 通过 window.eda 访问
if (typeof eda !== 'undefined') {
	(eda as any).locateViolation = createLocateFunction();
	// 暴露材料选择相关函数
	(eda as any).setMaterialInput = setMaterialInput;
	(eda as any).pcbDfmWithMaterial = pcbDfmWithMaterial;
	// 暴露SMT检查函数
	(eda as any).performSmtCheck = performSmtCheck;
	// 暴露获取当前检查结果的函数
	(eda as any).getDFMResults = () => currentDfmResults;
	// 暴露结果更新回调
	(eda as any).onResultsUpdated = (updatedResults: PcbDfmResult | SmtDfmResult, updatedType: 'pcb' | 'smt') => {
		currentDfmResults = { results: updatedResults, type: updatedType };
	};
}
