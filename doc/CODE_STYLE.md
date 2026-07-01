# 编码规范与风格指南

## 项目概述

本项目是嘉立创 EDA 专业版扩展插件开发 SDK，使用 TypeScript 编写。

---

## TypeScript 代码规范 (src/index.ts)

### 基本格式规范

- **缩进**: 使用 **Tab** 制表符
- **引号**: 使用 **单引号** `'`
- **分号**: 每条语句必须使用 **分号** `;` 结尾
- **编码**: UTF-8

### TypeScript 配置

```json
{
	"target": "ESNext",
	"module": "CommonJS",
	"strict": true,
	"strictNullChecks": true
}
```

### 代码风格示例

```typescript
/**
 * 函数文档注释
 * 使用 JSDoc 风格的多行注释
 */
export function functionName(param1: string, param2?: number): void {
	// 使用单行注释进行说明
	const variable = 'value';

	// 函数调用
	eda.sys_Dialog.showInformationMessage(
		'消息内容',
		'标题',
	);
}

// 空行分隔不同逻辑块
export function anotherFunction(): void {
	// ...
}
```

### 命名规范

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 函数 | 小驼峰 (camelCase) | `dfmCheck()`, `about()` |
| 变量 | 小驼峰 (camelCase) | `extensionConfig`, `status` |
| 常量 | 全大写下划线 | `MAX_RETRY_COUNT` |
| 类 | 大驼峰 (PascalCase) | `DFMChecker` |
| 接口 | 大驼峰 + I 前缀 | `ISCH_Primitive` |

### 注释规范

```typescript
/**
 * 多行文档注释
 * 用于函数、类、重要逻辑的说明
 */
export function activate(status?: 'onStartupFinished', arg?: string): void {}

// 单行注释：简要说明
const value = 123;

// TODO: 待办事项
// FIXME: 需要修复的问题
// NOTE: 重要提示
```

### 导出规范

所有需要在 `extension.json` 中引用的函数必须使用 `export` 导出：

```typescript
export function activate(): void {}
export function dfmCheck(): void {}
export function about(): void {}
```

---

## JSON 配置规范 (extension.json)

### 基本格式规范

- **缩进**: 使用 **Tab** 制表符
- **引号**: 使用 **双引号** `"`
- **末尾**: 不添加尾随逗号
- **编码**: UTF-8

### 必需字段

```json
{
	"name": "插件名称 (仅可包含小写英文字符 a-z、数字 0-9 与中划线 -，长度为 5-30 个字符)",
	"uuid": "32位小写字母和数字 (不含连字符)",
	"displayName": "显示名称",
	"description": "插件描述",
	"version": "版本号 (如 1.0.0)",
	"entry": "./dist/index",
	"engines": {
		"eda": "^3.0.0"
	}
}
```

### 命名规范

| 字段 | 规范 | 示例 |
|------|------|------|
| name | 使用小写字母和连字符 `-` | `"jlc-pcb-dfm-checker"` |
| uuid | 32位小写字母数字，无连字符 | `"54195a4d50924d1ab77d65cb46c82a45"` |
| id | 小驼峰命名 | `"dfmMenu"`, `"DFMChecker"` |
| registerFn | 与导出函数名一致 | `"dfmCheck"`, `"about"` |

### 菜单配置示例

```json
{
	"headerMenus": {
		"pcb": [
			{
				"id": "dfmMenu",
				"title": "DFM 工具",
				"menuItems": [
					{
						"id": "DFMChecker",
						"title": "DFM 检查...",
						"registerFn": "dfmCheck"
					}
				]
			}
		]
	}
}
```

---

## ESLint 配置

本项目使用 `@antfu/eslint-config`，配置如下：

```javascript
export default antfu({
	stylistic: {
		indent: 'tab',
		quotes: 'single',
		semi: true,
	},
	typescript: true,
});
```

### 检查命令

```bash
# 检查代码规范
npm run lint

# 自动修复问题
npm run fix
```

---

## 常见错误

### ❌ 错误示例

```typescript
// 错误：使用双引号
const message = 'Hello';

// 错误：缺少分号
const value = 123;

// 错误：使用空格缩进
export function test() {

}
```

### ✅ 正确示例

```typescript
// 正确：使用单引号
const message = 'Hello';

// 正确：使用分号结尾
const value = 123;

// 正确：使用 Tab 缩进
export function test() {

}
```

---

## 文件结构

```
pro-api-sdk/
├── src/
│   └── index.ts          # 入口文件，导出所有扩展函数
├── extension.json         # 扩展配置文件
├── tsconfig.json          # TypeScript 配置
├── eslint.config.mjs      # ESLint 配置
└── dist/                  # 编译输出目录
    └── index.js
```

---

## 开发流程

1. 修改 `src/index.ts` 添加功能
2. 运行 `npm run compile` 编译
3. 运行 `npm run build` 打包
4. 导入 `build/dist/*.eext` 文件到嘉立创 EDA

---

## 参考文档

- [嘉立创 EDA 扩展 API 文档](https://prodocs.lceda.cn/cn/api/guide/)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [ESLint 文档](https://eslint.org/docs/latest/)
