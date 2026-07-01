/**
 * 几何计算工具模块
 *
 * 提供线段间距、点-线段距离、焊环宽度等几何计算功能
 * 用于 DFM 检查中无法通过 API 直接获取的距离/间距数据
 */

/**
 * 点 (二维坐标)
 */
export interface Point {
	x: number;
	y: number;
}

/**
 * 线段
 */
export interface LineSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * 计算两点之间的距离平方
 * @param p1 点1
 * @param p2 点2
 * @returns 距离平方
 */
function distanceSquared(p1: Point, p2: Point): number {
	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}

/**
 * 计算两点之间的距离
 * @param p1 点1
 * @param p2 点2
 * @returns 距离
 */
export function distance(p1: Point, p2: Point): number {
	return Math.sqrt(distanceSquared(p1, p2));
}

/**
 * 计算点到线段的最近距离
 * @param point 点坐标
 * @param line 线段
 * @returns 点到线段的最短距离
 */
export function pointToLineSegmentDistance(point: Point, line: LineSegment): number {
	const {x1, y1, x2, y2} = line;
	const A = {x: x1, y: y1};
	const B = {x: x2, y: y2};

	// 计算点 A 到点 B 的距离平方
	const ABLength2 = distanceSquared(A, B);

	// 如果线段长度为0，返回点到端点的距离
	if (ABLength2 === 0) {
		return distance(point, A);
	}

	// 计算投影参数 t
	// t = ((point - A) · (B - A)) / |B - A|^2
	const t = ((point.x - A.x) * (B.x - A.x) + (point.y - A.y) * (B.y - A.y)) / ABLength2;

	// 如果投影在线段外，返回到最近端点的距离
	if (t < 0) {
		return distance(point, A);
	}
	if (t > 1) {
		return distance(point, B);
	}

	// 投影在线段上，计算垂线距离
	// 最近点 = A + t * (B - A)
	const closestX = A.x + t * (B.x - A.x);
	const closestY = A.y + t * (B.y - A.y);

	return distance(point, {x: closestX, y: closestY});
}

/**
 * 计算两条线段之间的最短距离
 * @param line1 线段1
 * @param line2 线段2
 * @returns 两条线段之间的最短距离
 */
export function lineToLineSegmentDistance(line1: LineSegment, line2: LineSegment): number {
	// 检查4种端点组合：line1端点到line2的距离，line2端点到line1的距离
	const p1 = {x: line1.x1, y: line1.y1};
	const p2 = {x: line1.x2, y: line1.y2};
	const p3 = {x: line2.x1, y: line2.y1};
	const p4 = {x: line2.x2, y: line2.y2};

	const d1 = pointToLineSegmentDistance(p1, line2);
	const d2 = pointToLineSegmentDistance(p2, line2);
	const d3 = pointToLineSegmentDistance(p3, line1);
	const d4 = pointToLineSegmentDistance(p4, line1);

	return Math.min(d1, d2, d3, d4);
}

/**
 * 判断点是否在线段上(用于检查是否共线)
 * @param point 点
 * @param line 线段
 * @param tolerance 容差，默认1e-6
 * @returns 是否在线段上
 */
export function isPointOnLineSegment(point: Point, line: LineSegment, tolerance: number = 1e-6): boolean {
	const {x1, y1, x2, y2} = line;

	// 检查点是否在线段的包围盒内
	const minX = Math.min(x1, x2);
	const maxX = Math.max(x1, x2);
	const minY = Math.min(y1, y2);
	const maxY = Math.max(y1, y2);

	if (point.x < minX - tolerance || point.x > maxX + tolerance ||
		point.y < minY - tolerance || point.y > maxY + tolerance) {
		return false;
	}

	// 检查点是否在直线上(叉积为0)
	const crossProduct = (point.x - x1) * (y2 - y1) - (point.y - y1) * (x2 - x1);
	return Math.abs(crossProduct) < tolerance;
}

/**
 * 计算焊环宽度
 * @param padDiameter 焊盘外径
 * @param holeDiameter 孔径
 * @returns 焊环宽度
 */
export function calculatePadRingWidth(padDiameter: number, holeDiameter: number): number {
	if (!holeDiameter || holeDiameter === 0) {
		// 无孔焊盘，返回0
		return 0;
	}
	return (padDiameter - holeDiameter) / 2;
}

/**
 * 从 EDA 线段图元获取线段数据
 * @param line EDA 线段图元
 * @returns 线段对象
 */
export function lineToSegment(line: any): LineSegment {
	return {
		x1: line.x1 || line.startX || 0,
		y1: line.y1 || line.startY || 0,
		x2: line.x2 || line.endX || 0,
		y2: line.y2 || line.endY || 0,
	};
}

/**
 * 从 EDA 焊盘图元获取外径
 * @param pad EDA 焊盘图元
 * @returns 外径
 */
export function getPadDiameter(pad: any): number {
	// 对于圆形焊盘
	if (pad.diameter !== undefined) {
		return pad.diameter;
	}

	// 对于其他形状，可能需要根据形状计算
	// 这里返回一个估算值，实际实现可能需要更复杂的计算
	if (pad.width && pad.height) {
		return Math.max(pad.width, pad.height);
	}

	return 0;
}

/**
 * 检查焊盘是否为插件焊盘
 * @param pad EDA 焊盘图元
 * @returns 是否为插件焊盘
 */
export function isPluginPad(pad: any): boolean {
	// 有孔且孔径大于一定值的焊盘通常为插件焊盘
	if (pad.hole && pad.hole.diameter) {
		return pad.hole.diameter > 0.3; // 孔径大于0.3mm
	}
	return false;
}

/**
 * 检查 pad 的孔是否为 OBLONG(长孔/槽孔)
 * @param pad EDA 焊盘图元
 * @returns 是否为长孔
 */
export function isOblongHole(pad: any): boolean {
	if (pad.hole && pad.hole.type) {
		return pad.hole.type === 'OBLONG' || pad.hole.type === 'OVAL';
	}
	return false;
}

/**
 * 获取 pad 的孔径信息
 * @param pad EDA 焊盘图元
 * @returns 孔径信息 {diameter, width, length}
 */
export function getHoleInfo(pad: any): {diameter?: number; width?: number; length?: number} {
	if (!pad.hole) {
		return {};
	}

	const hole = pad.hole;
	if (hole.type === 'OBLONG' || hole.type === 'OVAL') {
		return {
			width: hole.width || 0,
			length: hole.length || 0,
		};
	}

	return {
		diameter: hole.diameter || 0,
	};
}

/**
 * 计算矩形的外接圆直径
 * @param width 宽度
 * @param height 高度
 * @returns 外接圆直径
 */
export function getBoundingCircleDiameter(width: number, height: number): number {
	return Math.sqrt(width * width + height * height);
}

/**
 * 检查两个线段是否平行
 * @param line1 线段1
 * @param line2 线段2
 * @param tolerance 容差
 * @returns 是否平行
 */
export function areLinesParallel(line1: LineSegment, line2: LineSegment, tolerance: number = 1e-6): boolean {
	const dx1 = line1.x2 - line1.x1;
	const dy1 = line1.y2 - line1.y1;
	const dx2 = line2.x2 - line2.x1;
	const dy2 = line2.y2 - line2.y1;

	// 叉积为0表示平行
	const crossProduct = dx1 * dy2 - dy1 * dx2;
	return Math.abs(crossProduct) < tolerance;
}

/**
 * 计算两条平行线段之间的距离
 * @param line1 线段1
 * @param line2 线段2
 * @returns 距离
 */
export function parallelLineDistance(line1: LineSegment, line2: LineSegment): number {
	// 取线段1的一个端点，计算到线段2的距离
	const p1 = {x: line1.x1, y: line1.y1};
	return pointToLineSegmentDistance(p1, line2);
}
