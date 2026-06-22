# 立创 DFM 工具实现计划

> 本文档依据 `DFM需求.txt`(权威需求)、`@jlceda/pro-api-types`(真实 SDK 接口)与**当前实现**编写,
> 用于指导「嘉立创 DFM 检查工具」扩展的开发与维护。所有引用的 API 均已在 SDK 类型定义中核实存在。

## 项目概述

开发一个嘉立创 EDA 专业版专用的 DFM(Design for Manufacturing)检查工具扩展,检测当前 PCB 设计参数是否符合嘉立创的生产工艺要求。

- **定位**:仅对嘉立创官方工艺做检测,**不提供定制化参数**(定制化能力已由 V4 部分提供)。
- **检测范围**:**PCB DFM**(18 项)+ **SMT DFM**(5 项,经济型/标准型双标准)。FPC 见「未来扩展」。
- **交付要求**:支持点击坐标定位违规元素、输出报告与日志;补充 README 与 Logo 以便上架扩展广场。
- **周期**:预计一周完成。

## 项目时间线

> 以下时间线以当前日期 2026-06-22 为基准，按「一周可交付」进行排期。

| 日期 | 里程碑 | 目标产出 |
|------|--------|----------|
| 2026-06-22 | 需求确认与环境准备 | 核对需求、确认 SDK API、搭建开发环境 |
| 2026-06-23 | 数据采集与标准接入 | 完成图元/图层采集、文档源解析、板材标准映射 |
| 2026-06-24 | PCB DFM 核心检查 | 完成 9 项直接可测项与基础日志输出 |
| 2026-06-25 | 几何与特殊元件检查 | 完成槽孔、线距、焊环、BGA 等几何项 |
| 2026-06-26 | 交互与展示闭环 | 完成 IFrame 明细、定位高亮、报告导出与菜单使能 |
| 2026-06-27 | 验证与文档整理 | 进行功能验证、修复问题、补齐 README/Logo 说明 |
| 2026-06-28 | 发布前收尾 | 执行构建、打包 `.eext`、准备上架材料 |

> 关键节点：第 3~5 天完成核心检测逻辑，第 6~7 天完成交互与发布准备。

> **相对初版计划的变更(已落地)**
> - **移除「外层铜厚」弹窗输入**——铜厚改由解析文档源 `LAYER_PHYS` 记录获取(TOP/BOT 层 `thicknessMil` → `copperMilToOz()`),读不到时回退 `DEFAULT_COPPER_THICKNESS`,不再依赖用户填写。
> - **移除「层压结构」检查项**——API 无接口,且原实现是永远返回通过的占位 stub;移除后 PCB 检查由 19 项调整为 **18 项**,后续项编号顺延。
> - **「过孔类型」实现盲孔/埋孔单独识别**——`EPCB_PrimitiveViaType.BLIND` 把盲埋合并,无法区分;故改用 `via.designRuleBlindViaName` + 解析文档源盲埋孔设计规则(`ruleContext.blinds.content` 的 `staLayerId`/`endLayerId`),按层范围判定盲/埋(详见 3.5)。
> - **清理诊断日志**——移除图层数/图元数/铜厚 mil-oz 详情/过孔计数等开发期调试输出,日志面板只保留功能性内容(检查开始/完成、表头、结果行、错误)。
>
> **第二轮修复(API 用法核对,已落地)**
> - **覆铜识别修正**——`parseCopperLayerCount()` 原用 `pcb_PrimitiveRegion`(区域图元,非覆铜)导致有铜层永远判 0;改用 `pcb_PrimitivePour`(覆铜边框)+ `pcb_PrimitivePoured`(覆铜填充),边框层经 `getState_Layer()` 判定。
> - **第 8 项「过孔钻孔直径」→「钻孔直径」**——扩展为**过孔 + 焊盘**钻孔,并按**实际铜层数**动态取标准(单面板 0.3 / 双面板·多层板 0.15 / 2-12 层且板厚≤1mm 支持 0.1mm 微孔),焊盘孔经 `getState_Hole()` 取元组。
> - **第 9 项外径**——过孔 `getState_Diameter()`、焊盘 `getState_Pad()` 形状元组取宽高较大值;actualValue 统一过孔+焊盘最小外径。
> - **第 10/11 项槽孔重写**——`getState_Hole()` 返回元组 `["SLOT",diameter,length]`,`hole[0]==='SLOT'` 判槽孔;有铜/无铜由 `getState_Metallization()` 判定(非 padType);**槽宽=hole[1](半圆直径),槽长=hole[2](总长,已含两端半圆)**,actualValue 显示槽宽/槽长值。
> - **关键结论:`getAll()` 返回类实例**,pad/via 的孔径、形状、外径等属性为 protected/private,**必须经 `getState_*()` 访问**;焊盘孔/形状为元组(类型为字符串枚举 `ROUND`/`SLOT`),非对象。

---

## 一、核心需求

### 1.1 菜单结构(5 个菜单项,挂在 PCB 编辑器头部菜单 `headerMenus.pcb`)

| 菜单项 | 功能 | 使能条件 |
|--------|------|----------|
| **PCB DFM** | 执行 PCB 18 项检查,结果入日志面板 + 弹出可点击明细 | 始终可用 |
| **SMT DFM** | 先弹「经济型/标准型」选择框,再执行 5 项检查 | 始终可用 |
| **PCB DFM 报告** | 弹保存路径对话框,导出 PCB 报告 | **仅在 PCB 检查完成后使能** |
| **SMT DFM 报告** | 弹保存路径对话框,导出 SMT 报告 | **仅在 SMT 检查完成后使能** |
| **日志** | 打开底部日志面板并筛选 DFM 相关日志 | 始终可用 |

> 菜单注册见 [extension.json](extension.json) 的 `headerMenus.pcb.dfmMenuGroup`,函数名与导出一致。

### 1.2 技术特点

- 使用嘉立创固定标准,无需用户定制工艺参数。
- 违规项给出**坐标 + 原因**,可在明细表中点击定位高亮对应元素。
- 不影响 PCB/原理图绘制。
- 支持上架扩展广场(需 README 与 Logo;Logo 已有 [images/logo.png](images/logo.png),README 需重写为插件说明)。

---

## 二、架构设计

### 2.1 文件结构

```
pro-api-sdk/
├── src/
│   ├── index.ts                 # 入口,导出 5 个菜单函数 + 检查编排(已实现)
│   └── dfm/
│       ├── types.ts             # 类型定义(完整)
│       ├── standards.ts         # 嘉立创 6 种板材 + 2 套 SMT 标准(完整)
│       ├── geometry.ts          # 自研几何运算:线段间距、点-线段距离、焊环计算
│       └── locate.ts            # 定位服务:按 primitiveId 选中 + 缩放
├── iframe/
│   ├── material-selector.html   # PCB 板材选择(板材类型 / 板厚)
│   ├── smt-selector.html        # SMT 标准选择(经济型/标准型,二选一)
│   ├── dfm-results.html         # 可点击的检查结果明细表
│   ├── dfm-dialog.html          # 遗留页面,当前无代码引用,暂不启用
│   └── index.html               # SDK 示例页(保留)
├── images/logo.png              # 插件 Logo
├── extension.json               # 扩展清单(已配置 5 菜单)
└── README.md                    # 说明文档(需由 SDK 默认改写为插件说明)
```

> 现状:[src/index.ts](src/index.ts) 与上述 iframe 页面均已实现;PCB 弹窗只采集「板材类型 + 板厚」两项(外层铜厚与层压结构已移除)。

### 2.2 数据流

```
菜单点击 → (PCB) 板材/板厚弹窗 → 采集图元/图层 + 解析文档源(LAYER_PHYS 铜厚、盲埋孔规则)
       → 逐项比对标准 → 日志面板输出摘要 + IFrame 弹出可点击明细
       → (报告菜单使能) → 保存路径对话框 → 导出 .txt 报告
```

---

## 三、PCB DFM 检查项(18 项)

> 对应 `DFM需求.txt` 第 2.1.1 节(原第 2~20 栏,其中「层压结构」栏已移除)。所有几何量比对前须用 `eda.sys_Unit.milToMm()` 把图元数据(mil)换算为 mm,标准值在 [standards.ts](src/dfm/standards.ts) 中已以 mm 给出。

### 3.1 基础信息检查

| # | 检测项 | 数据来源 | 可行性 | 说明 |
|---|--------|----------|--------|------|
| 1 | 板材类型 | **弹窗用户选择** | 🟡 依赖输入 | 用户从 `JLC_SUPPORTED_MATERIALS` 选择,并驱动后续按板材查标准 |
| 2 | 层数 | `eda.pcb_Layer.getAllLayers()` 过滤铜层 | ✅ 派生 | 与板材层数范围比对 |
| 3 | 纵横尺寸 | 板框图元 `eda.pcb_Primitive.getPrimitivesBBox()` | ✅ | 取最大长宽,与板材尺寸范围比对 |
| 4 | 板厚 | **弹窗用户填写** | 🟡 依赖输入 | API 无接口 |
| 5 | 外层铜厚 | 解析文档源 `LAYER_PHYS`(层 id 1/2 的 `thicknessMil`) | ✅ | `copperMilToOz()` 换算;读不到回退 `DEFAULT_COPPER_THICKNESS` |
| 6 | 内层铜厚 | 解析文档源 `LAYER_PHYS`(内层铜层 id 15~44) | ✅ | 仅 FR4 / 高频板支持内层 |
| 7 | 过孔类型 | `via.designRuleBlindViaName` + `parseBlindViaRules()` | ✅ | 盲孔/埋孔单独识别,见 3.5 |

### 3.2 过孔与槽孔检查

| # | 检测项 | 数据来源 | 可行性 | 说明 |
|---|--------|----------|--------|------|
| 8 | 钻孔直径 | `via.getState_HoleDiameter()` + `pad.getState_Hole()` | ✅ | **含过孔+焊盘钻孔**;按实际铜层数动态取标准(见 3.6) |
| 9 | 过孔/焊盘外径 | `via.getState_Diameter()` / `pad.getState_Pad()` 形状元组 | ✅ | pad 外径取形状元组宽高较大值;actualValue 取过孔+焊盘最小外径 |
| 10 | 有铜槽孔 | `pad.getState_Hole()`=`['SLOT',d,l]` + `getState_Metallization()=true` | ✅ | 槽宽=d(半圆直径),槽长=l(总长含半圆);最小槽宽 0.6/槽长 1.0 |
| 11 | 无铜槽孔 | 同上 + `getState_Metallization()=false` | ✅ | 最小槽宽 0.6;槽宽/槽长值均显示 |

### 3.3 线路与间距检查

| # | 检测项 | 数据来源 | 可行性 | 说明 |
|---|--------|----------|--------|------|
| 12 | 最小线宽 | `line.getState_LineWidth()` | ✅ | 与 `minTraceWidth` 比对 |
| 13 | 最小线距 | **自研线段间距运算** | 🟠 自研几何 | SDK 无距离 API |
| 14 | 焊盘/过孔到线间距 | **自研点-线段距离运算** | 🟠 自研几何 | 同上 |
| 15 | 有铜插件焊盘焊环 | pad 外径 − 孔径,插件孔判定 | 🟠 自研几何 | 与 `minPluginPadRingWithCopper` 比对 |
| 16 | 无铜插件焊盘焊环 | 同上(无铜) | 🟠 自研几何 | 与 `minPluginPadRingWithoutCopper` 比对 |

### 3.4 特殊元件与丝印检查

| # | 检测项 | 数据来源 | 可行性 | 说明 |
|---|--------|----------|--------|------|
| 17 | BGA 焊盘 | 识别 BGA 元件 + 焊盘直径/间距 | 🟠 自研几何 | 与 `minBgaPadDiameter` / `minBgaPadToLineSpacing` 比对 |
| 18 | 丝印字符 | `string.getState_FontSize()` / `getState_LineWidth()` | ✅ | 高度/粗细/到裸铜间隙 |

### 3.5 盲孔/埋孔识别(第 7 项实现细节)

`EPCB_PrimitiveViaType` 枚举只有 `VIA=通孔`、`BLIND=盲埋孔`(盲孔与埋孔**合并**)、`SUTURE=缝合孔`,**无法直接区分盲孔与埋孔**。当前实现绕开枚举,改走文档源:

1. via 运行时取 `designRuleBlindViaName`(`getState_DesignRuleBlindViaName()`):`null` / 空 → **通孔**;否则为某个盲埋孔设计规则名称。
2. `parseBlindViaRules()` 解析文档源(`getDocumentSource()`)里的 `RULE`(BLIND/blindVia)记录,`ruleContext.blinds.content[]` 每项形如 `{ name, staLayerId, endLayerId, viaSizeRule }`,建立 `name → {staLayerId, endLayerId}` 映射。
3. `classifyBlindBuried(staLayerId, endLayerId)` 判定:表层 = TOP(1) / BOTTOM(2);起止层**恰一个**为表层 → **盲孔**;**都非**表层 → **埋孔**。

> 字段名 `staLayerId`(非 startLayer)与 `ruleContext.blinds.content` 结构未公开文档化(格式文档称 ruleContext「EDA 自己决定」),逆向自示例板确认。

> 🟡 = 依赖用户输入 · ✅ = 直接可测 · 🟠 = 需自研几何运算

### 3.6 钻孔直径动态标准(第 8 项实现细节)

第 8 项「钻孔直径」覆盖**过孔 + 焊盘(插件孔)**两类钻孔,标准按**实际铜层数**(`parseCopperLayerCount()` 返回值)动态选取,而非按板材:

| 实际铜层数 | 最小钻孔直径 | 最大 | 说明 |
|-----------|-------------|------|------|
| 1(单面板) | 0.3 mm | 6.3 mm | 单面板工艺 |
| 2(双面板) | 0.15 mm | 6.3 mm | 双面板工艺 |
| ≥3(多层板) | 0.15 mm | 6.3 mm | 多层板工艺 |
| 2–12 层且**板厚≤1mm** | **0.1 mm** | 6.3 mm | 微孔工艺(限沉金) |

> 焊盘钻孔取自 `getState_Hole()`:圆孔 `['ROUND',d]` 取 d;槽孔 `['SLOT',d,l]` 取 d(槽宽即钻孔直径)。actualValue 取所有钻孔(过孔+焊盘)的 min-max 区间。

---

## 四、SMT DFM 检查项(5 项)

> 对应 `DFM需求.txt` 第 3.1.1 节「第 2 栏 ~ 第 6 栏」。执行前弹窗选择「经济型 / 标准型」(互斥单选),标准定义见 [standards.ts](src/dfm/standards.ts) `SMT_STANDARDS`。

| # | 检测项 | 经济型标准 | 标准型标准 | 数据来源 |
|---|--------|-----------|-----------|----------|
| 1 | 焊接面 | 支持双面 | 支持双面 | `eda.pcb_PrimitiveComponent.getAll()` 按 TOP/BOT 层过滤 |
| 2 | 层数 | 2 / 4 / 6 层 | 无限制 | 图层派生 |
| 3 | 板厚 | 0.8–1.6 mm | 无限制 | 弹窗用户填写(复用 PCB) |
| 4 | 纵横尺寸 | 10×10 – 470×570 mm | 70×70 – 460×510 mm | 板框 BBox |
| 5 | 最小封装 | 0402 | 0201 | 元件封装映射 `COMMON_PACKAGES` + `isPackageSmaller()` |

> 原 [src/index.ts](src/index.ts) 中的第 6 项「组装工艺」不在需求规格内,**已删除**。

---

## 五、用户界面设计

### 5.1 展示策略:混合方案

需求要求「结果展示在底部日志面板」且「点击坐标高亮定位」,但 `sys_Log` **不支持点击回调**。故采用混合方案:

- **底部日志面板**(`eda.sys_PanelControl.openBottomPanel(ESYS_BottomPanelTab.LOG)`):输出表头 + 逐项摘要文本(编号/项目/实际值/标准值/结果),满足「日志面板展示」字面要求。
- **IFrame 可点击明细**(`eda.sys_IFrame.openIFrame('./iframe/dfm-results.html', ...)`):展示带坐标的违规明细表,点击违规行 → 调用定位服务选中并缩放对应元素,满足「点击高亮」硬需求。

### 5.2 交互流程

1. **PCB DFM**:点击菜单 → 弹「板材类型 / 板厚」填写框 → 采集数据 → 18 项检查 → 日志摘要 + 明细 IFrame。
2. **SMT DFM**:点击菜单 → 弹「经济型/标准型」单选框 + 确定 → 5 项检查 → 日志摘要 + 明细 IFrame。
3. **报告**:检查完成后对应报告菜单使能;点击 → `sys_FileSystem.saveFile()` 保存路径对话框 → 导出 `.txt`。
4. **日志**:打开底部面板,`eda.sys_Log.find(['DFM','嘉立创','检查'])` 筛选。

### 5.3 明细表列结构(与需求表头一致)

`编号 | 检测项目 | PCB 实际值 | 嘉立创标准值 | 比对结果`,违规行附 `(x, y)` 坐标与原因,可点击定位。

---

## 六、关键技术实现

### 6.1 数据采集(真实 API)

```typescript
// 图元遍历(均返回 Promise,需 await)
const pads = await eda.pcb_PrimitivePad.getAll();
const vias = await eda.pcb_PrimitiveVia.getAll();
const lines = await eda.pcb_PrimitiveLine.getAll();
const strings = await eda.pcb_PrimitiveString.getAll();
const components = await eda.pcb_PrimitiveComponent.getAll();
const layers = await eda.pcb_Layer.getAllLayers();              // 层数派生(过滤铜层)
const boardBBox = await eda.pcb_Primitive.getPrimitivesBBox(boardOutlineIds); // 纵横尺寸
const docSource = await eda.sys_FileManager.getDocumentSource(); // 文档源:解析铜厚/盲埋孔规则

// 覆铜(注意:Region 是区域图元,非覆铜)
const pours   = await eda.pcb_PrimitivePour.getAll();   // 覆铜边框,getState_Layer() 取层
const poureds = await eda.pcb_PrimitivePoured.getAll(); // 覆铜填充,经 pourPrimitiveId 关联边框取层
```

> `eda.pcb_Document` 仅提供 `navigateToCoordinates / navigateToRegion / zoomToBoardOutline`,
> **没有** `getBoardInfo()` / `getBoardThickness()` / `getLayerStackup()`——板材/板厚走弹窗,铜厚与盲埋孔层范围走文档源解析。

### 6.2 单位换算(必须)

API 坐标/尺寸单位为 **mil**,标准值为 **mm**:

```typescript
const mm = eda.sys_Unit.milToMm(valueMil); // 比对前一律换算
```

### 6.3 材料弹窗驱动标准查询

```typescript
// 用户选择板材后,取出该板材的完整标准
const standard = JLC_MATERIAL_STANDARDS[userMaterial]; // e.g. FR4 → MaterialStandard
// 后续 8~18 项均以 standard 内的阈值比对
```

> 弹窗([material-selector.html](iframe/material-selector.html))只采集「板材类型 + 板厚」;铜厚与过孔类型不向用户索取,均从文档源解析。

### 6.4 自研几何运算(`src/dfm/geometry.ts`)

SDK 无距离/间距/相交 API,需自行实现:

- 线段-线段最短距离(最小线距,第 13 项)
- 点-线段距离(焊盘/过孔到线,第 14 项)
- 焊环宽度 = pad 外径 − 孔径(第 15/16 项)
- BGA 焊盘识别与间距(第 17 项)
- 可借助 `eda.pcb_MathPolygon.discretize()` 将多边形图元离散为点参与计算。

### 6.5 按元素 ID 定位(`src/dfm/locate.ts`)

```typescript
// 点击违规行时,按 primitiveId 定位(SDK 无 selectByLocation,但有按 ID 选中 + 缩放)
await eda.pcb_SelectControl.doSelectPrimitives(violation.id);
await eda.pcb_Document.navigateToCoordinates(violation.x, violation.y); // 或 zoomToRegion
```

> 检查阶段已记录每个违规项的 `primitiveId` 与坐标(见 [types.ts](src/dfm/types.ts) `ViolationCoord`),故按 ID 定位比按坐标更准。

### 6.6 文档源解析(`src/index.ts`)

`getDocumentSource()` 返回紧凑 JSON(每行一条记录,`{header}||{body}|`)。两类记录被解析:

- `parseLayerPhys()`:提取 `LAYER_PHYS` 记录 → `Map<层id, {thicknessMil, material}>`,供第 5/6 项(外层/内层铜厚)使用。
- `parseBlindViaRules()`:提取 `RULE`(BLIND/blindVia)记录的 `ruleContext.blinds.content` → `Map<name, {staLayerId, endLayerId}>`,供第 7 项盲/埋分类使用。

---

## 七、实现步骤

| 阶段 | 内容 | 产出 |
|------|------|------|
| ① 基础与数据采集 | 板材/板厚弹窗、图元/图层采集、mil→mm 换算、文档源解析 | 可拿到全部原始数据 |
| ② 直接可测项 | 第 2/3/5/6/7/8/9/12/18 项(✅) | 9 项检查落地 |
| ③ 自研几何项 | 第 13/14/15/16/17 项(🟠)+ 槽孔 10/11(🟡) | 几何模块 + 7 项检查 |
| ④ 用户输入项 | 第 1/4 项弹窗(🟡) | 板材/板厚弹窗驱动标准 |
| ⑤ SMT | 标准选择框 + 5 项检查 | SMT 完成 |
| ⑥ 展示与导出 | 日志摘要 + IFrame 可点击明细 + 定位 + 报告导出 + 菜单使能 | 闭环 |
| ⑦ 发布 | 重写 README、确认 Logo、`npm run build` 打包 `.eext` | 可上架 |

---

## 八、使用的嘉立创 EDA API(均已核实)

### 数据获取
- `eda.pcb_PrimitivePad.getAll(): Promise<IPCB_PrimitivePad[]>`
- `eda.pcb_PrimitiveVia.getAll(): Promise<IPCB_PrimitiveVia[]>`
- `eda.pcb_PrimitiveLine.getAll(): Promise<IPCB_PrimitiveLine[]>`
- `eda.pcb_PrimitiveString.getAll(): Promise<IPCB_PrimitiveString[]>`
- `eda.pcb_PrimitiveComponent.getAll(): Promise<IPCB_PrimitiveComponent[]>`
- `eda.pcb_Layer.getAllLayers(): Promise<IPCB_LayerItem[]>`(过滤铜层得层数)
- `eda.pcb_Primitive.getPrimitivesBBox(ids): Promise<{minX,minY,maxX,maxY}>`
- `eda.sys_FileManager.getDocumentSource(): Promise<string>`(文档源,解析铜厚/盲埋孔规则)

### 图元属性(`getState_*`)
- via:`getState_HoleDiameter()` / `getState_Diameter()` / `getState_ViaType()` / **`getState_DesignRuleBlindViaName()`**(盲埋孔规则名,null=通孔)
- line:`getState_LineWidth()`、起止坐标
- string:`getState_FontSize()` / `getState_LineWidth()`
- pad:`getState_Pad()`(形状元组 `[形状,宽,高]`,外径取宽高较大值)、`getState_Hole()`(孔元组 `['ROUND',d]` 圆孔 / `['SLOT',d,l]` 槽孔,**类型为字符串枚举**)、`getState_Metallization()`(是否金属化孔壁→有铜/无铜)
- via/pad 的孔径、直径、形状等字段为 **protected/private**,`getAll()` 返回类实例,**必须经 `getState_*()` 读取**,直接 `.holeDiameter`/`.diameter`/`.hole` 取不到

### 单位 / 几何
- `eda.sys_Unit.milToMm(mil, decimals?)`
- `eda.pcb_MathPolygon.discretize(polygon)`(多边形离散)

### 选择 / 定位
- `eda.pcb_SelectControl.doSelectPrimitives(ids): Promise<boolean>`
- `eda.pcb_Document.navigateToCoordinates(x, y): Promise<boolean>`
- `eda.pcb_Document.navigateToRegion(left, right, top, bottom): Promise<boolean>`

### 系统
- `eda.sys_Log.add(msg, ESYS_LogType)` / `.clear()` / `.find(keys)`
- `eda.sys_PanelControl.openBottomPanel(ESYS_BottomPanelTab.LOG)`
- `eda.sys_Dialog.showInformationMessage(...)` / `showSelectDialog(...)`(标准选择)
- `eda.sys_FileSystem.saveFile(data, fileName): Promise<void>`
- `eda.sys_IFrame.openIFrame(html, w, h, id, props)` / `.close(id)`
- `eda.sys_I18n.text(tag)`

> ⚠️ **注意区分易混 API**:
> - `getBoardInfo(boardName)` 存在,但属于 `DMT_Board`(工程文档树管理),返回 `IDMT_BoardItem`(仅 name/schematic/pcb/uuid),**不含板材/板厚/层压**——故第 1/4 项走弹窗填写。
> - **确实不存在**:`getBoardThickness` / `getLayerStackup` / `getLayerCopperThickness` / `selectByLocation`(勿再引用);铜厚请走 `getDocumentSource()` 解析 `LAYER_PHYS`。
> - `zoomTo(x,y)` 属于顶层 `eda`(`eda.zoomTo`),`pcb_Document` 上无此方法;定位请用 `pcb_Document.navigateToCoordinates` / `navigateToRegion`。
> - `EPCB_PrimitiveViaType.BLIND` 把盲孔/埋孔合并,不能直接区分;盲/埋判定走 `designRuleBlindViaName` + 文档源盲埋孔规则(见 3.5)。
> - **覆铜≠Region**:`pcb_PrimitiveRegion` 是区域图元(非覆铜),覆铜用 `pcb_PrimitivePour`(边框)/`pcb_PrimitivePoured`(填充);误用 Region 会导致有铜层判定为 0。
> - 焊盘孔/形状是**元组**(`['ROUND',d]`/`['SLOT',d,l]`/`['ELLIPSE',w,h]`),孔类型为字符串枚举 `'ROUND'`/`'SLOT'`(非数字 0/1);勿用 `hole.type`/`hole.width`。

---

## 九、预期成果

- ✅ PCB DFM **18 项**检查(9 项直接可测 + 7 项自研几何 + 2 项弹窗输入)
- ✅ SMT DFM **5 项**检查(经济型/标准型双标准)
- ✅ 盲孔 / 埋孔单独识别(第 7 项)
- ✅ 混合展示:日志面板摘要 + IFrame 可点击明细
- ✅ 点击违规坐标定位高亮元素
- ✅ PCB/SMT 报告导出(菜单按结果使能)
- ✅ 上架材料:README(重写)+ Logo(已有)+ `.eext` 打包

---

## 十、附录:嘉立创工艺标准参考

### 支持板材(详见 [standards.ts](src/dfm/standards.ts) `JLC_MATERIAL_STANDARDS`)
- **FR4**:1–64 层,0.4–6.0 mm,支持盲埋孔(可区分盲/埋),最小线宽/线距 0.15 mm
- **CEM-1**:1–2 层,0.8–2.0 mm,仅通孔
- **铝基板**:1–2 层,0.5–3.0 mm,仅通孔
- **铜基板**:1–2 层,1.0–3.0 mm,仅通孔
- **高频板**:1–32 层,0.4–3.0 mm,仅通孔
- **HDI 板**:4–32 层,0.4–2.5 mm,支持盲埋孔(可区分盲/埋),最小线宽/线距 0.1 mm

### SMT 双标准(`SMT_STANDARDS`)
- **经济型**:2/4/6 层,0.8–1.6 mm,10×10–470×570 mm,最小 0402
- **标准型**:层数/板厚不限,70×70–460×510 mm,最小 0201

### 参考链接
1. 嘉立创 EDA 文件格式:https://prodocs.lceda.cn/cn/format/index/
2. 嘉立创工艺参数:https://www.jlc.com/portal/vtechnology.html
3. 嘉立创 HDI 高密度互连板:https://www.jlc.com/portal/server_guide_51763.html
4. 嘉立创高频板:https://www.jlc.com/portal/server_guide_36391.html
5. 嘉立创单面铝基板:https://www.jlc.com/portal/server_guide_27793.html
6. 嘉立创铜基板:https://www.jlc.com/portal/q7i35951.html

### 未来扩展
- **FPC DFM**:需求开头提及「可检测 pcb/fpc/smt」,但详细规格未定义 FPC 菜单与检查项,本期不做,留待后续版本。
