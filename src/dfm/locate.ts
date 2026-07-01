/**
 * DFM 定位服务模块
 *
 * 提供按 primitiveId 定位并高亮图元的功能
 * 用于点击违规坐标时定位到对应的 PCB 元素
 */

import type { ViolationCoord } from './types';

/**
 * 定位违规项
 * @param violation 违规坐标信息
 * @returns 是否成功定位
 */
export async function locateViolation(violation: ViolationCoord): Promise<boolean> {
    try {
        // 选中对应的图元
        const selectSuccess = await eda.pcb_SelectControl.doSelectPrimitives([violation.id]);

        if (!selectSuccess) {
            console.warn(`Failed to select primitive: ${violation.id}`);
            return false;
        }

        // 导航到坐标位置
        const navigateSuccess = await eda.pcb_Document.navigateToCoordinates(
            violation.x,
            violation.y,
        );

        if (!navigateSuccess) {
            console.warn(`Failed to navigate to coordinates: (${violation.x}, ${violation.y})`);
            // 即使导航失败，选中成功也算部分成功
            return true;
        }

        return true;
    }
    catch (error) {
        console.error(`Error locating violation: ${error}`);
        return false;
    }
}

/**
 * 定位到指定区域
 * @param x1 左边界
 * @param y1 下边界
 * @param x2 右边界
 * @param y2 上边界
 * @returns 是否成功定位
 */
export async function navigateToRegion(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): Promise<boolean> {
    try {
        return await eda.pcb_Document.navigateToRegion(x1, x2, y1, y2);
    }
    catch (error) {
        console.error(`Error navigating to region: ${error}`);
        return false;
    }
}

/**
 * 选中多个图元
 * @param ids 图元ID列表
 * @returns 是否成功选中
 */
export async function selectPrimitives(ids: string[]): Promise<boolean> {
    try {
        return await eda.pcb_SelectControl.doSelectPrimitives(ids);
    }
    catch (error) {
        console.error(`Error selecting primitives: ${error}`);
        return false;
    }
}

/**
 * 缩放到板框
 * @returns 是否成功缩放
 */
export async function zoomToBoardOutline(): Promise<boolean> {
    try {
        return await eda.pcb_Document.zoomToBoardOutline();
    }
    catch (error) {
        console.error(`Error zooming to board outline: ${error}`);
        return false;
    }
}

/**
 * 暴露给 iframe 调用的定位函数
 * 这个函数会被挂载到 window.eda.locateViolation 上
 */
export function createLocateFunction() {
    return (id: string, x: number, y: number, type: string) => {
        const violation: ViolationCoord = {
            id,
            x: Number(x),
            y: Number(y),
            reason: '',
            type: type as ViolationCoord['type'],
        };

        void locateViolation(violation);
    };
}
