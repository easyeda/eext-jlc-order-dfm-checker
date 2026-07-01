import JSZip from 'jszip';
import type { PcbDfmResult, SmtDfmResult } from './types';

/**
 * DFM 报告 .xlsx 生成(嘉立创 PCB/SMT DFM 共用)。
 * 用 jszip 拼装最小 OOXML:两 sheet(检查结果 / 违规明细),
 * 表头蓝底白字、错误行标红、警告行标黄、通过行标绿。
 * 无新依赖(jszip 已在),不依赖 eda,可在扩展运行时直接生成 Blob。
 */

/** XML 文本节点转义 */
function xlsxEsc(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 生成一个 inlineStr 单元格;s 为样式索引(见 buildXlsxStyles) */
function xlsxCell(ref: string, text: string, style: number): string {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xlsxEsc(text)}</t></is></c>`;
}

const XLSX_CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

const XLSX_ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

const XLSX_WORKBOOK = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="检查结果" sheetId="1" r:id="rId1"/><sheet name="违规明细" sheetId="2" r:id="rId2"/></sheets></workbook>';

const XLSX_WORKBOOK_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

/** styles.xml;样式索引:0默认 1标题 2meta键 3meta值 4表头 5通过 6警告 7错误 8普通数据 */
function buildXlsxStyles(): string {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="7">'
        + '<font><sz val="11"/><name val="等线"/></font>'
        + '<font><b/><sz val="14"/><name val="等线"/></font>'
        + '<font><b/><sz val="11"/><name val="等线"/></font>'
        + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="等线"/></font>'
        + '<font><sz val="11"/><color rgb="FFC00000"/><name val="等线"/></font>'
        + '<font><sz val="11"/><color rgb="FF9C5700"/><name val="等线"/></font>'
        + '<font><sz val="11"/><color rgb="FF1E7E34"/><name val="等线"/></font>'
        + '</fonts>'
        + '<fills count="6">'
        + '<fill><patternFill patternType="none"/></fill>'
        + '<fill><patternFill patternType="gray125"/></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FF4472C4"/><bgColor indexed="64"/></patternFill></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FFFCE4E4"/><bgColor indexed="64"/></patternFill></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CD"/><bgColor indexed="64"/></patternFill></fill>'
        + '<fill><patternFill patternType="solid"><fgColor rgb="FFD4EDDA"/><bgColor indexed="64"/></patternFill></fill>'
        + '</fills>'
        + '<borders count="2">'
        + '<border><left/><right/><top/><bottom/><diagonal/></border>'
        + '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>'
        + '</borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="9">'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
        + '<xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>'
        + '<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>'
        + '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>'
        + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>'
        + '</cellXfs>'
        + '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>';
}

/** sheet1:标题 + meta + 检查项总览表(标准值/实际值/结果并排,错误行标红) */
function buildXlsxSheet1(title: string, result: PcbDfmResult | SmtDfmResult, metaRows: Array<{ label: string; value: string }>): string {
    const rows: string[] = [];
    let r = 1;
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, title, 1)}</row>`); r++;
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '检查时间', 2)}${xlsxCell(`B${r}`, new Date(result.timestamp).toLocaleString('zh-CN'), 3)}</row>`); r++;
    for (const m of metaRows) {
        rows.push(`<row r="${r}">${xlsxCell(`A${r}`, m.label, 2)}${xlsxCell(`B${r}`, m.value, 3)}</row>`); r++;
    }
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '检查结果', 2)}${xlsxCell(`B${r}`, result.passed ? '通过' : '不通过', result.passed ? 5 : 7)}</row>`); r++;
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '错误数量', 2)}${xlsxCell(`B${r}`, String(result.errorCount), 3)}</row>`); r++;
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '警告数量', 2)}${xlsxCell(`B${r}`, String(result.warningCount), 3)}</row>`); r++;
    r++;
    const headerRow = r;
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '编号', 4)}${xlsxCell(`B${r}`, '检测项目', 4)}${xlsxCell(`C${r}`, '标准值', 4)}${xlsxCell(`D${r}`, '实际值', 4)}${xlsxCell(`E${r}`, '结果', 4)}</row>`); r++;
    for (const cr of result.results) {
        const st = cr.result === 'success' ? 5 : cr.result === 'warning' ? 6 : 7;
        const badge = cr.result === 'success' ? 'OK' : cr.result === 'warning' ? '警告' : '错误';
        rows.push(`<row r="${r}">${xlsxCell(`A${r}`, String(cr.number), st)}${xlsxCell(`B${r}`, cr.item, st)}${xlsxCell(`C${r}`, cr.standardValue, st)}${xlsxCell(`D${r}`, cr.actualValue, st)}${xlsxCell(`E${r}`, badge, st)}</row>`); r++;
    }
    const lastDataRow = r - 1;
    const cols = '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="16" customWidth="1"/><col min="5" max="5" width="8" customWidth="1"/></cols>';
    const merge = '<mergeCells count="1"><mergeCell ref="A1:E1"/></mergeCells>';
    const filter = `<autoFilter ref="A${headerRow}:E${lastDataRow}"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows.join('')}</sheetData>${merge}${filter}</worksheet>`;
}

/** sheet2:违规明细(编号/坐标/原因);无违规则提示一行 */
function buildXlsxSheet2(result: PcbDfmResult | SmtDfmResult): string {
    const vItems = result.results.filter(cr => cr.violations && cr.violations.length > 0);
    const rows: string[] = [];
    let r = 1;
    const headerRow = r;
    rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '编号', 4)}${xlsxCell(`B${r}`, '坐标', 4)}${xlsxCell(`C${r}`, '原因', 4)}</row>`); r++;
    if (vItems.length === 0) {
        rows.push(`<row r="${r}">${xlsxCell(`A${r}`, '无违规项,全部通过', 8)}${xlsxCell(`B${r}`, '', 8)}${xlsxCell(`C${r}`, '', 8)}</row>`); r++;
    }
    else {
        for (const cr of vItems) {
            const vs = cr.violations;
            if (!vs) continue;
            for (const v of vs) {
                const coord = `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`;
                rows.push(`<row r="${r}">${xlsxCell(`A${r}`, String(cr.number), 8)}${xlsxCell(`B${r}`, coord, 8)}${xlsxCell(`C${r}`, v.reason, 8)}</row>`); r++;
            }
        }
    }
    const lastRow = r - 1;
    const cols = '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="3" width="60" customWidth="1"/></cols>';
    const filter = vItems.length > 0 ? `<autoFilter ref="A${headerRow}:C${lastRow}"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows.join('')}</sheetData>${filter}</worksheet>`;
}

/** 生成 .xlsx Blob;交由 eda.sys_FileSystem.saveFile 保存 */
export async function generateDfmXlsxBlob(title: string, result: PcbDfmResult | SmtDfmResult, metaRows: Array<{ label: string; value: string }> = []): Promise<Blob> {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', XLSX_CONTENT_TYPES);
    zip.folder('_rels')!.file('.rels', XLSX_ROOT_RELS);
    const xl = zip.folder('xl')!;
    xl.file('styles.xml', buildXlsxStyles());
    xl.file('workbook.xml', XLSX_WORKBOOK);
    xl.folder('_rels')!.file('workbook.xml.rels', XLSX_WORKBOOK_RELS);
    const ws = xl.folder('worksheets')!;
    ws.file('sheet1.xml', buildXlsxSheet1(title, result, metaRows));
    ws.file('sheet2.xml', buildXlsxSheet2(result));
    return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) as Blob;
}
