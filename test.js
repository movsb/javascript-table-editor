import { Table } from './table.js';

class Tests {
	constructor() {
		/**
		 * @type {{ note: string, init: (t: Table) => void, html: string, error: string }[]}
		 */
		this.cases = [
			{
				init: t => { t.reset(2,2); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td></tr><tr><td>2,1</td><td>2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2'}],},
						{cols: [{data:'2,1'},{data:'2,2'}],}
					],
				},
			},
			{
				init: t => { t.reset(2,2); t.selectCell(1,2); },
				html: '<table><tbody><tr><td>1,1</td><td class="selected">1,2</td></tr><tr><td>2,1</td><td>2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2', selected: true}],},
						{cols: [{data:'2,1'},{data:'2,2'}],}
					],
				}
			},
			{
				note: '选区：↗️',
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.selectRange(2,1,1,2); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td class="selected">1,2</td></tr><tr><td class="selected">2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 2, selected: true},{data:'1,2', selected: true}],},
						{cols: [{data:'2,2', selected: true}],}
					],
				}
			},
			{
				note: '选区：自动扩展',
				init: t => { t.reset(3,3); t.selectRange(1,2,2,3); t.merge(); t.selectRange(2,1,3,2); },
				html: '<table><tbody><tr><td class="selected">1,1</td><td rowspan="2" colspan="2" class="selected">1,2</td></tr><tr><td class="selected">2,1</td></tr><tr><td class="selected">3,1</td><td class="selected">3,2</td><td class="selected">3,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', selected: true},{data:'1,2', row_span: 2, col_span: 2, selected: true}],},
						{cols: [{data:'2,1', selected: true}],},
						{cols: [{data:'3,1', selected: true},{data:'3,2', selected: true},{data:'3,3', selected: true}],}
					],
				}
			},
			{
				note: '插入行：向上',
				init: t => { t.reset(2,2); t.selectCell(1,1); t.addRowAbove(); },
				html: '<table><tbody><tr><td></td><td></td></tr><tr><td class="selected">1,1</td><td>1,2</td></tr><tr><td>2,1</td><td>2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:''},{data:''}],},
						{cols: [{data:'1,1', selected: true},{data:'1,2'}],},
						{cols: [{data:'2,1'},{data:'2,2'}],}
					],
				}
			},
			{
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); },
				html: '<table><tbody><tr><td>1,1</td><td rowspan="2" class="selected">1,2</td></tr><tr><td>2,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2', row_span: 2, selected: true}],},
						{cols: [{data:'2,1'}],}
					],
				}
			},
			{
				note: '插入行：内部包含合并',
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); t.selectCell(1,1); t.addRowAbove(); t.addRowBelow(); },
				html:  '<table><tbody><tr><td></td><td></td></tr><tr><td class="selected">1,1</td><td rowspan="3">1,2</td></tr><tr><td></td></tr><tr><td>2,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:''},{data:''}],},
						{cols: [{data:'1,1',selected:true},{data:'1,2', row_span: 3}]},
						{cols: [{data:''}]},
						{cols: [{data:'2,1'}]},
					],
				}
			},
			{
				note: '插入列：在合并列的右边',
				init: t => { t.reset(2,1); t.selectRange(1,1,2,1); t.merge(); t.addColRight(); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td></td></tr><tr><td></td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 2, selected: true},{data:''}]},
						{cols: [{data:''}]},
					],
				}
			},
			{
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); t.addColLeft(); },
				html: '<table><tbody><tr><td>1,1</td><td></td><td rowspan="2" class="selected">1,2</td></tr><tr><td>2,1</td><td></td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:''},{data:'1,2', row_span: 2, selected: true}],},
						{cols: [{data:'2,1'},{data:''}],}
					],
				}
			},
			{
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.selectCell(2,2); t.addColLeft(); },
				html: '<table><tbody><tr><td rowspan="3">1,1</td><td></td><td>1,2</td></tr><tr><td></td><td class="selected">2,2</td></tr><tr><td></td><td>3,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 3},{data:''},{data:'1,2'}],},
						{cols: [{data:''},{data:'2,2', selected: true}],},
						{cols: [{data:''},{data:'3,2'}],}
					],
				}
			},
			{
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.selectCell(2,2); t.addColRight(); t.selectRange(2,2,2,3); t.merge(); t.addColLeft(); },
				html: '<table><tbody><tr><td rowspan="3">1,1</td><td></td><td>1,2</td><td></td></tr><tr><td></td><td colspan="2" class="selected">2,2</td></tr><tr><td></td><td>3,2</td><td></td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 3},{data:''},{data:'1,2'},{data:''}],},
						{cols: [{data:''},{data:'2,2', col_span: 2, selected: true}],},
						{cols: [{data:''},{data:'3,2'},{data:''}],}
					],
				}
			},
			{
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.selectCell(1,2); t.addColLeft(); },
				html: '<table><tbody><tr><td>1,1</td><td></td><td class="selected">1,2</td><td>1,3</td></tr><tr><td>2,1</td><td></td><td rowspan="2" colspan="2">2,2</td></tr><tr><td>3,1</td><td></td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:''},{data:'1,2', selected: true},{data:'1,3'}],},
						{cols: [{data:'2,1'},{data:''},{data:'2,2', row_span: 2, col_span: 2}],},
						{cols: [{data:'3,1'},{data:''}],}
					],
				}
			},
			{
				note: '合并并拆分',
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.split(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td>1,3</td></tr><tr><td>2,1</td><td class="selected">2,2</td><td></td></tr><tr><td>3,1</td><td></td><td></td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2'},{data:'1,3'}],},
						{cols: [{data:'2,1'},{data:'2,2', selected: true},{data:''}],},
						{cols: [{data:'3,1'},{data:''},{data:''}],}
					],
				}
			},
			{
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.selectRange(1,2,2,2);  t.merge(); t.split(); },
				html: '<table><tbody><tr><td rowspan="2">1,1</td><td class="selected">1,2</td></tr><tr><td></td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 2},{data:'1,2', selected: true}],},
						{cols: [{data:''}],}
					],
				}
			},
			{
				note: '删除行，单行元素',
				init: t => { t.reset(3,3); t.selectCell(1,2); t.deleteRows(); },
				html: '<table><tbody><tr><td>2,1</td><td>2,2</td><td>2,3</td></tr><tr><td>3,1</td><td>3,2</td><td>3,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'2,1'},{data:'2,2'},{data:'2,3'}],},
						{cols: [{data:'3,1'},{data:'3,2'},{data:'3,3'}],}
					],
				}
			},
			{
				note: '删除行，多行元素，来自上面',
				init: t => { t.reset(3,3); t.selectRange(1,2,3,2); t.merge(); t.selectCell(3,1); t.deleteRows(); },
				html: '<table><tbody><tr><td>1,1</td><td rowspan="2">1,2</td><td>1,3</td></tr><tr><td>2,1</td><td>2,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2', row_span: 2},{data:'1,3'}],},
						{cols: [{data:'2,1'},{data:'2,3'}],}
					],
				}
			},
			{
				note: '删除行，多行元素，向下展开',
				init: t => { t.reset(3,3); t.selectRange(1,2,3,2); t.merge(); t.selectCell(1,1); t.deleteRows(); },
				html: '<table><tbody><tr><td>2,1</td><td rowspan="2">1,2</td><td>2,3</td></tr><tr><td>3,1</td><td>3,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'2,1'},{data:'1,2', row_span: 2},{data:'2,3'}],},
						{cols: [{data:'3,1'},{data:'3,3'}],}
					],
				}
			},
			{
				note: '删除行，重新计算坐标',
				init: t => { t.reset(3,3); t.selectRange(1,3,3,3); t.merge(); t.selectRange(1,1,2,1); t.deleteRows(); },
				html: '<table><tbody><tr><td>3,1</td><td>3,2</td><td>1,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'3,1'},{data:'3,2'},{data:'1,3'}],}
					],
				}
			},
			{
				note: '删除行，自动合并',
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.selectCell(1,2); t.deleteRows(); },
				html: '<table><tbody><tr><td rowspan="2">1,1</td><td>2,2</td></tr><tr><td>3,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 2},{data:'2,2'}],},
						{cols: [{data:'3,2'}],}
					],
				}
			},
			{
				note: '删除列，单列元素',
				init: t => { t.reset(3,3); t.selectCell(1,2); t.deleteCols(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,3</td></tr><tr><td>2,1</td><td>2,3</td></tr><tr><td>3,1</td><td>3,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,3'}],},
						{cols: [{data:'2,1'},{data:'2,3'}],},
						{cols: [{data:'3,1'},{data:'3,3'}],}
					],
				}
			},
			{
				note: '删除列，多列元素，来自左边',
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.selectCell(1,3); t.deleteCols(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td></tr><tr><td>2,1</td><td rowspan="2" colspan="1">2,2</td></tr><tr><td>3,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2'}],},
						{cols: [{data:'2,1'},{data:'2,2', row_span: 2}],},
						{cols: [{data:'3,1'}],}
					],
				}
			},
			{
				note: '删除列，多列元素，向右展开',
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.selectCell(1,2); t.deleteCols(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,3</td></tr><tr><td>2,1</td><td rowspan="2">2,2</td></tr><tr><td>3,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,3'}],},
						{cols: [{data:'2,1'},{data:'2,2', row_span: 2}],},
						{cols: [{data:'3,1'}],}
					],
				}
			},
			{
				note: '删除列，自动合并',
				init: t => { t.reset(3,3); t.selectRange(1,1,1,3); t.merge(); t.selectCell(2,1); t.deleteCols(); },
				html: '<table><tbody><tr><td colspan="2">1,1</td></tr><tr><td>2,2</td><td>2,3</td></tr><tr><td>3,2</td><td>3,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', col_span: 2}],},
						{cols: [{data:'2,2'},{data:'2,3'}],},
						{cols: [{data:'3,2'},{data:'3,3'}],}
					],
				}
			},
			{
				note: '移动列',
				init: t => { t.reset(4,4); t.selectRange(2,2,2,3); t.merge(); t.selectRange(3,1,4,1); t.merge(); t.selectRange(3,3,4,3); t.merge(); t.clearSelection(); t.moveCols(2,3,1); },
				html: '<table><tbody><tr><td>1,2</td><td>1,3</td><td>1,4</td><td>1,1</td></tr><tr><td colspan="2">2,2</td><td>2,4</td><td>2,1</td></tr><tr><td>3,2</td><td rowspan="2">3,3</td><td>3,4</td><td rowspan="2">3,1</td></tr><tr><td>4,2</td><td>4,4</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,2'},{data:'1,3'},{data:'1,4'},{data:'1,1'}],},
						{cols: [{data:'2,2', col_span: 2},{data:'2,4'},{data:'2,1'}],},
						{cols: [{data:'3,2'},{data:'3,3', row_span: 2},{data:'3,4'},{data:'3,1', row_span: 2}],},
						{cols: [{data:'4,2'},{data:'4,4'}],}
					],
				}
			},
			{
				note: '移动列：和首列交换',
				init: t => { t.reset(1,4); t.moveCols(2,1,1); t.moveCols(3,1,2); },
				html: '<table><tbody><tr><td>1,2</td><td>1,3</td><td>1,1</td><td>1,4</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,2'},{data:'1,3'},{data:'1,1'},{data:'1,4'}],}
					],
				}
			},
			{
				note: '移动列：固定表头',
				init: t => { t.reset(3,3); t.selectRange(1,2,1,3); t.merge(); t.moveCols(2,1,4); },
				html:  '<table><tbody><tr><td>1,1</td><td colspan="2" class="selected">1,2</td></tr><tr><td>2,1</td><td>2,3</td><td>2,2</td></tr><tr><td>3,1</td><td>3,3</td><td>3,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2', col_span: 2, selected: true}],},
						{cols: [{data:'2,1'},{data:'2,3'},{data:'2,2'}],},
						{cols: [{data:'3,1'},{data:'3,3'},{data:'3,2'}],}
					],
				}
			},
			{
				note: '移动列：从合并列外尝试移入',
				init: t => { t.reset(2,3); t.selectRange(1,2,1,3); t.merge(); t.moveCols(1,1,3); },
				error:  'Error: cannot move cols',
			},
			{
				note: '移动列：从非合并列外尝试移入到合并列前',
				init: t => { t.reset(2,3); t.selectRange(1,1,1,2); t.merge(); t.moveCols(3,1,1); },
				html: '<table><tbody><tr><td>1,3</td><td colspan="2" class="selected">1,1</td></tr><tr><td>2,3</td><td>2,1</td><td>2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,3'},{data:'1,1', col_span: 2, selected: true}],},
						{cols: [{data:'2,3'},{data:'2,1'},{data:'2,2'}],}
					],
				}
			},
			{
				note: '移动行',
				init: t => { t.reset(4,3); t.selectRange(3,2,4,3); t.merge(); t.moveRows(3,2,2); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td>1,3</td></tr><tr><td>3,1</td><td rowspan="2" colspan="2" class="selected">3,2</td></tr><tr><td>4,1</td></tr><tr><td>2,1</td><td>2,2</td><td>2,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2'},{data:'1,3'}],},
						{cols: [{data:'3,1'},{data:'3,2', row_span: 2, col_span: 2, selected: true}],},
						{cols: [{data:'4,1'}],},
						{cols: [{data:'2,1'},{data:'2,2'},{data:'2,3'}],}
					],
				}
			},
			{
				note: '移动行：包含多行',
				init: t => { t.reset(3,2); t.selectRange(1,1,2,1); t.merge(); t.moveRows(1,2,4); },
				html: '<table><tbody><tr><td>3,1</td><td>3,2</td></tr><tr><td rowspan="2" class="selected">1,1</td><td>1,2</td></tr><tr><td>2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'3,1'},{data:'3,2'}],},
						{cols: [{data:'1,1', row_span: 2, selected: true},{data:'1,2'}],},
						{cols: [{data:'2,2'}],}
					],
				}
			},
			{
				note: '移动行：包含多行，同时两行',
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.moveRows(1,2,4); },
				html: '<table><tbody><tr><td rowspan="3" class="selected">1,1</td><td>3,2</td></tr><tr><td>1,2</td></tr><tr><td>2,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 3, selected: true},{data:'3,2'}],},
						{cols: [{data:'1,2'}],},
						{cols: [{data:'2,2'}],},
					],
				}
			},
			{
				note: '移动行：多行内移动，下移',
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td>2,2</td></tr><tr><td>1,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 2, selected: true},{data:'2,2'}],},
						{cols: [{data:'1,2'}],}
					],
				}
			},
			{
				note: '移动行：多行内移动，上移',
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td>2,2</td></tr><tr><td>1,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 2, selected: true},{data:'2,2'}],},
						{cols: [{data:'1,2'}],}
					],
				}
			},
			{
				note: '移动行：多行内移动，多个跨行',
				init: t => { t.reset(4,3); t.selectRange(1,1,4,1); t.merge(); t.selectRange(2,2,3,2); t.merge(); t.moveRows(2,1,4); },
				html: '<table><tbody><tr><td rowspan="4">1,1</td><td>1,2</td><td>1,3</td></tr><tr><td rowspan="2" class="selected">2,2</td><td>3,3</td></tr><tr><td>2,3</td></tr><tr><td>4,2</td><td>4,3</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', row_span: 4},{data:'1,2'},{data:'1,3'}],},
						{cols: [{data:'2,2', row_span: 2, selected: true},{data:'3,3'}],},
						{cols: [{data:'2,3'}],},
						{cols: [{data:'4,2'},{data:'4,3'}],}
					],
				}
			},
			{
				note: '移动行：多行内移动，跨行在右边',
				init: t => { t.reset(3,2); t.selectRange(1,2,3,2); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td>2,1</td><td rowspan="3" class="selected">1,2</td></tr><tr><td>1,1</td></tr><tr><td>3,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'2,1'},{data:'1,2', row_span: 3, selected: true}],},
						{cols: [{data:'1,1'}],},
						{cols: [{data:'3,1'}],}
					],
				}
			},
			{
				note: '移动行：多行内移动，跨行在右边，两列',
				init: t => { t.reset(2,3); t.selectRange(1,2,2,2); t.merge(); t.selectRange(1,3,2,3); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td>2,1</td><td rowspan="2">1,2</td><td rowspan="2" class="selected">1,3</td></tr><tr><td>1,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'2,1'},{data:'1,2', row_span: 2},{data:'1,3', row_span: 2, selected: true}],},
						{cols: [{data:'1,1'}],}
					],
				}
			},
			{
				note: '撤销：不双重保存，因为内部调用了 split（原本也会再自己 save 一次）',
				init: t => { t.reset(3,3); t.selectRange(1,3,3,3); t.merge(); t.selectCell(1,1); t.deleteRows(); t.undo(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td rowspan="3">1,3</td></tr><tr><td>2,1</td><td>2,2</td></tr><tr><td>3,1</td><td>3,2</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2'},{data:'1,3', row_span: 3}],},
						{cols: [{data:'2,1'},{data:'2,2'}],},
						{cols: [{data:'3,1'},{data:'3,2'}],}
					],
				}
			},
			{
				note: '切换表头（自动扩展）',
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); t.selectCell(1,1); t.toHeaderRows(); },
				html: '<table><tbody><tr><th>1,1</th><th rowspan="2">1,2</th></tr><tr><th>2,1</th></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', header: true},{data:'1,2', row_span: 2, header: true}],},
						{cols: [{data:'2,1', header: true}],}
					],
				}
			},
			{
				note: '切换表头',
				init: t => { t.reset(4,4); t.selectRange(1,4,2,4); t.merge(); t.toHeaderRows(); t.selectRange(4,1,4,2); t.merge(); t.toHeaderCols(); },
				html: '<table><tbody><tr><th>1,1</th><th>1,2</th><th>1,3</th><th rowspan="2">1,4</th></tr><tr><th>2,1</th><th>2,2</th><th>2,3</th></tr><tr><th>3,1</th><th>3,2</th><td>3,3</td><td>3,4</td></tr><tr><th colspan="2">4,1</th><td>4,3</td><td>4,4</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1', header: true},{data:'1,2', header: true},{data:'1,3', header: true},{data:'1,4', row_span: 2, header: true}],},
						{cols: [{data:'2,1', header: true},{data:'2,2', header: true},{data:'2,3', header: true}],},
						{cols: [{data:'3,1', header: true},{data:'3,2', header: true},{data:'3,3'},{data:'3,4'}],},
						{cols: [{data:'4,1', col_span: 2, header: true},{data:'4,3'},{data:'4,4'}],}
					],
				}
			},
			{
				note: '二次合并时候因为选区包含重复元素（错误计算）导致行被清除',
				init: t => { t.reset(2,3); t.selectRange(2,1,2,2); t.merge(); t.selectRange(2,1,2,3); t.merge(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td>1,3</td></tr><tr><td colspan="3" class="selected">2,1</td></tr></tbody></table>',
				json: {
					version: 1,
					rows: [
						{cols: [{data:'1,1'},{data:'1,2'},{data:'1,3'}],},
						{cols: [{data:'2,1', col_span: 3, selected: true}],}
					],
				}
			},
		];
	}

	run() {
		this.cases.forEach((t, index) => {
			const table = new Table();

			table._resetWithCoords = true;
			table._fill_with_nbsp = false;

			try {
				try {
					t.init(table);
				} catch(e) {
					if(t.error == `${e}`) {
						return;
					}
					throw e;
				}
			} finally {
				table.remove();
			}
			const json = table.getJSON({ withSelected: true });
			if(json != JSON.stringify(t.json)) {
				console.table({note: `测试错误：${t.note ?? ''}`, init: t.init.toString(), want: JSON.stringify(t.json), got: json});
				throw new Error(`测试错误: @${index}`);
			}

			const html = table.getContent();
			if(html != t.html) {
				console.table({note: `测试错误：${t.note ?? ''}`, init: t.init.toString(), want: t.html, got: html});
				throw new Error(`测试错误: @${index}`);
			}
		});
	}
}

export function TableTest() {
	try {
		const tt = new Tests();
		tt.run();
		console.log('测试全部通过');
	} catch(e) {
		console.error(e);
	}
}
