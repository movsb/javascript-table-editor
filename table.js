class Table {
	constructor() {
		this.table = document.createElement('table');
		document.body.appendChild(this.table);

		/** @type {HTMLTableCellElement | null} */
		this.curCell = null;

		/**
		 * 从左到右、从上到下。
		 * 但是要注意：最后一个元素不一定在视觉上是最右下角的元素。
		 * @type {HTMLTableCellElement[]}
		 */
		this.selectedCells = [];

		/** @type {Boolean} 是否展示调试内容。 */
		this._resetWithCoords = false;
		/** @type {Boolean} 是否 fix empty line height */
		this._fixLineHeight = true;

		// Redo/Undo 数据。
		// https://github.com/movsb/tinymde-with-undo-redo/blob/main/index.html
		this._stack = [];
		this._stackIndex = -1;
	
		this._handleEvents();
	}

	static isDesktopDevice() {
		return !('ontouchstart' in window);
	}

	/**
	 * 从事件元素 element 获取当前的单元格。
	 * 
	 * @param {HTMLElement} element 
	 * @returns {HTMLTableCellElement | null}
	 */
	_getCellFromEventTarget(element) {
		// document.elementFromPoint 可能返回空，需要处理。
		if (!element) return null;
		if(element instanceof HTMLDocument) return null;
		element = element.closest('td') || element.closest('th');
		if(element && element.closest('table') == this.table) {
			return element;
		}
		return null;
	}

	_handleEvents() {
		this.table.addEventListener('click', (e) => {
			const cell = this._getCellFromEventTarget(e.target);
			if (!cell) { return; }
			this._selectCell(cell, false);
		});
		this.table.addEventListener('dblclick', (e) => {
			const cell = this._getCellFromEventTarget(e.target);
			if (!cell) { return; }
			if(cell == this.curCell && this._isEditing(cell)) {
				return;
			} 
			// 被反转选择清除掉了，选回来。
			// 注意，双击之前可能已经是单选状态，所以三击之后再次
			// 选择会导致清除（共四次），所以这里要 force。
			this._selectCell(cell, true);
			this._edit(cell, true);
		});


		if(Table.isDesktopDevice()) {
			this.table.addEventListener('keydown', e => {
				if(e.key == 'Tab' && this.curCell && this._isEditing(this.curCell)) {
					if(this._navigate(!e.shiftKey)) {
						e.preventDefault();
					}
				}
			});

			this.table.addEventListener('mousedown', e => {
				this._mousedownHandler(e);
			});
		} else {
			this.table.addEventListener('touchstart', e=> {
				if(e.touches.length > 1) { return; }
				this._mousedownHandler(e);
			});
		}
	}

	/**
	 * 从事件取坐标。兼容层。
	 * @typedef {Object} PointerPosition
	 * @property {number} clientX
	 * @property {number} clientY
	 * @property {number} offsetX
	 * @property {number} offsetY
	 * 
	 * @param {MouseEvent | TouchEvent} e 
	 * @returns {PointerPosition}
	 */
	_getPointerPosition(e) {
		const clientX = e.clientX ?? e.touches[0].clientX;
		const clientY = e.clientY ?? e.touches[0].clientY;

		let offsetX = e.offsetX;
		let offsetY = e.offsetY;

		if(offsetX === undefined) {
			const rc = e.target.getBoundingClientRect();
			offsetX = clientX - rc.left;
			offsetY = clientY - rc.top;
		}

		return { clientX, clientY, offsetX, offsetY };
	}

	_mousedownHandler(e) {
		const cell = this._getCellFromEventTarget(e.target);
		if(!cell) { return; }

		const startCell = cell;
		const startCellSelected = this._isSelected(startCell);

		/**
		 * lazy calculated
		 * @type {{valid: boolean, r1: number, r2: number, c1: number, c2: number}}
		 */
		let selectionCoords = null;
		/** @type {{valid: boolean, row: boolean, from: number, count: number, to: number}} */
		let moveCoords = {};

		/** @type {HTMLTableElement} */
		let shadow = null;
		let shadowShow = false;
		const pp = this._getPointerPosition(e);
		let shadowX = pp.offsetX, shadowY = pp.offsetY;
		let shadowClientX = pp.clientX, shadowClientY = pp.clientY;

		/** @type {HTMLDivElement} */
		let bar = null;
		/**
		 * @param {number}  pos         Bar X if vertical; Bar Y if Horizontal.
		 * @param {boolean} horizontal  Bar layout
		 */
		let placeBar = (pos, horizontal) => {
			if (!bar) {
				bar = document.createElement('div');
				bar.style.position = 'fixed';
				bar.style.pointerEvents = 'none';
				bar.style.backgroundColor = "var(--accent-color, 'gray')";
				document.body.appendChild(bar);
			}

			const rc = this.table.getBoundingClientRect();

			if(horizontal) {
				bar.style.left = `${rc.left}px`;
				bar.style.top = `${pos-1}px`;
				bar.style.height = '3px';
				bar.style.width = `${rc.width}px`;
			} else {
				bar.style.left = `${pos-1}px`;
				bar.style.top = `${rc.top}px`;
				bar.style.width = '3px';
				bar.style.height = `${rc.height}px`;
			}
		};

		/**
		 * @param {MouseEvent|TouchEvent} e 
		 */
		const moveHandler = e => {
			const pp = this._getPointerPosition(e);
			const cell = this._getCellFromEventTarget(
				Table.isDesktopDevice() ? e.target
				: document.elementFromPoint(pp.clientX, pp.clientY),
			);

			if(startCellSelected) {
				if(!shadowShow) {
					shadowShow = true;
					shadow = this._createShadow();
					shadow.style.opacity = 0.7;
					shadow.style.position = 'fixed';
					shadow.style.pointerEvents = 'none';
					document.body.appendChild(shadow);

					// lazy
					selectionCoords = this._calculateSelectionCoords();
				}

				// 鼠标在表格内移动。
				if (cell) {
					// 判断是水平移动还是纵向移动。
					const isHorizontal = Math.abs(pp.clientX-shadowClientX) > Math.abs(pp.clientY-shadowClientY);
					const rc = cell.getBoundingClientRect();
					const sc = selectionCoords;
					const cc = this._getCoords(cell);

					if (isHorizontal) {
						const center = rc.width / 2;
						const left = pp.offsetX < center;
						placeBar(left?rc.left:rc.right, false);
						moveCoords = {row: false, from: sc.c1, count: sc.c2-sc.c1+1, to: left ? cc.c1 : cc.c2+1};
						moveCoords.valid = sc.valid && this._canMoveCols(moveCoords.from, moveCoords.count, moveCoords.to);
						this.table.style.cursor = moveCoords.valid ? 'col-resize' : 'not-allowed';
					} else if(!isHorizontal) {
						const middle = rc.height / 2;
						const top = pp.offsetY < middle;
						placeBar(top?rc.top:rc.bottom, true);
						moveCoords = {row: true, from: sc.r1, count: sc.r2-sc.r1+1, to: top ? cc.r1 : cc.r2+1};
						moveCoords.valid = sc.valid && this._canMoveRows(moveCoords.from, moveCoords.count, moveCoords.to);
						this.table.style.cursor = moveCoords.valid ? 'row-resize' : 'not-allowed';
					}
				}

				// 即便不在表格内移动，也可以显示。
				shadow.style.left = `${pp.clientX - shadowX}px`;
				shadow.style.top = `${pp.clientY - shadowY}px`;
			} else {
				if(!cell) { return; }

				// 防止在同一个元素内移动时因频繁 clearSelection 导致失去编辑焦点。
				if (cell == startCell && this.selectedCells.length <= 1) {
					return;
				}

				this._selectRange(startCell, cell);
			}
		};

		if(!this._isEditing(startCell)) {
			document.addEventListener(
				Table.isDesktopDevice() ? 'mousemove' : 'touchmove',
				moveHandler,
			);

			const mouseupHandler = e => {
				document.removeEventListener(
					Table.isDesktopDevice() ? 'mousemove' : 'touchmove',
					moveHandler,
				);

				shadow && shadow.remove();
				bar && bar.remove();
				this.table.style.cursor = '';

				if(moveCoords?.valid) {
					if(moveCoords.row) {
						this.moveRows(moveCoords.from, moveCoords.count, moveCoords.to);
					} else {
						this.moveCols(moveCoords.from, moveCoords.count, moveCoords.to);
					}
				}
			};

			document.addEventListener(
				Table.isDesktopDevice() ? 'mouseup' : 'touchend',
				e => mouseupHandler(e), { once: true },
			);
		}
	}

	/**
	 * 导航到下一个、上一个单元格进行编辑。
	 * @param {boolean} next 
	 * @returns {boolean} 是否成功导航到下一个/上一个。
	 */
	_navigate(next) {
		const cc = this._getCoords(this.curCell);
		const maxCols = this._maxCols();
		let r = cc.r1, c = next ? cc.c2 + 1 : cc.c1 - 1;
		while(true) {
			if(c > maxCols) {
				r++;
				c = 1;
			} else if(c < 1) {
				r--;
				c = maxCols;
			}
			if(r > this.table.rows.length || r < 1) {
				this.clearSelection();
				return false;
			}
			const cell = this.findCell(r, c)
			const cc = this._getCoords(cell);
			if (cc.r1 !=  r) {
				c += next ? +1 : -1;
				continue;
			}
			this._selectCell(cell, true);
			this._edit(cell, true);
			return true;
		}
	}

	_calculateSelectionCoords() {
		const selection = [...this.selectedCells];
		if(this.curCell) selection.push(this.curCell);

		let r1 = this.table.rows.length, c1 = this._maxCols(), r2 = 1, c2 = 1;
		selection.forEach(cell => {
			const cc = this._getCoords(cell);
			r1 = Math.min(r1, cc.r1);
			c1 = Math.min(c1, cc.c1);
			r2 = Math.max(r2, cc.r2);
			c2 = Math.max(c2, cc.c2);
		});
		for(let r=r1; r<=r2; r++) {
			for(let c=c1; c<=c2; c++) {
				const cell = this.findCell(r, c);
				if(!this._isSelected(cell)) {
					return {valid: false};
				}
			}
		}
		return {valid: true, r1, r2, c1, c2};
	}

	/**
	 * 
	 * @returns {HTMLTableElement}
	 */
	_createShadow() {
		/** @type {NodeListOf<HTMLTableCellElement>} */
		const selection = [...this.selectedCells];
		this.curCell && selection.push(this.curCell);
		if(selection.length <= 0) {
			throw new Error('no selection');
		}

		// 为简单起见，基于最左上角的元素创建。
		let topLeft = selection[0];
		const cloned = topLeft.cloneNode(true);
		// highlight 非本表，这样好吗？
		this._highlight(cloned, true);
		const table = document.createElement('table');
		const tbody = document.createElement('tbody');
		const tr    = document.createElement('tr');
		tr.appendChild(cloned);
		tbody.appendChild(tr);
		table.appendChild(tbody);

		return table;
	}

	undo() {
		if (this._stackIndex <= 0) { return; }
		this._use(this._stack[--this._stackIndex]);
	}
	redo() {
		if(this._stackIndex+1 >= this._stack.length) { return; }
		this._use(this._stack[++this._stackIndex]);
	}
	_save() {
		const content = this.table.innerHTML;
		this._stack[++this._stackIndex] = content;
		this._stack.length = this._stackIndex+1;
	}
	_use(content) {
		this.table.innerHTML = content;
		let cells = this.table.querySelectorAll('.selected');
		cells.forEach(cell => this._highlight(cell, false));
		let cell = this.table.querySelector('.editing');
		if(cell) this._edit(cell, false);
		this._calcCoords();
	}

	/**
	 * @param {string: "<table>...</table>"} html 
	 */
	use(html) {
		const div = document.createElement('div');
		div.innerHTML = html;
		const table = div.firstElementChild;
		this._use(table.innerHTML);
		this._save();
	}

	/**
	 * 将表格重置为指定的大小。
	 * @param {number} rows 行数
	 * @param {number} cols 列数
	 * @param {{
	 *      headerRows?: number,    // 小于等于 number 的所有行被作为表头（从 1 开始）。
	 *      headerCols?: number,    // 小于等于 number 的所有列被作为表头（从 1 开始）。
	 *      showCoords?: boolean,   // 调试用：是否显示逻辑坐标。
	 * }} options 
	 */
	reset(rows, cols, options) {
		this.clearSelection();
		this.table.innerHTML = '';

		options = options ?? {};

		for(let r=0; r<rows; r++) {
			const tr = this.table.insertRow();
			const hr = r+1 <= (options.headerRows ?? 0);
			for(let c=0; c<cols; c++) {
				const hc = c+1 <= (options.headerCols ?? 0);
				const header = hr || hc;
				if(header) {
					const th = document.createElement('th');
					tr.appendChild(th);
				} else {
					const td = tr.insertCell();
				}
			}
			if(this._fixLineHeight) {
				// 任何列都可以。只是 firefox 上此单元格双击时不显示光标。
				const last = tr.cells[cols-1];
				last.innerHTML = '\u200b';
				last._fixing = true;
			}
		}

		this._calcCoords(options.showCoords || this._resetWithCoords);
		this._save();
	}

	remove() {
		this.table.remove();
	}

	/**
	 * 获取表格数据作为 HTML 数据保存。
	 * @returns {string}
	 * @todo 应该做一些清理工作：
	 *   1. 清理选区
	 *   2. 清理编辑状态
	 */
	getContent() {
		return this.table.outerHTML;
	}

	/**
	 * 
	 * @param {(cell: HTMLTableCellElement) => void} callback 
	 */
	_forEachCell(callback) {
		Array.from(this.table.rows).forEach(row => {
			Array.from(row.cells).forEach(cell => {
				callback(cell);
			});
		});
	}

	/**
	 * 
	 * @param {HTMLTableCellElement} cell 
	 * @returns {{r1: Number,c1: Number,r2: Number,c2: Number}}
	 */
	_getCoords(cell) {
		return cell._coords;
	}
	_setCoords(cell, coords) {
		cell._coords = coords;
	}
	
	/**
	 * @param {Number} r1 
	 * @param {Number} c1 
	 * @param {Number} r2 
	 * @param {Number} c2 
	 */
	selectRange(r1,c1,r2,c2) {
		const cell1 = this.findCell(r1, c1);
		const cell2 = this.findCell(r2, c2);
		return this._selectRange(cell1, cell2);
	}

	/**
	 * @param {HTMLTableCellElement} cell1 
	 * @param {HTMLTableCellElement} cell2 
	 */
	_selectRange(cell1, cell2) {
		const expandRange = (cell1, cell2) => {
			let cc1 = this._getCoords(cell1);
			let cc2 = this._getCoords(cell2);

			const r1 = Math.min(cc1.r1, cc2.r1);
			const c1 = Math.min(cc1.c1, cc2.c1);
			const r2 = Math.max(cc1.r2, cc2.r2);
			const c2 = Math.max(cc1.c2, cc2.c2);

			let mr1 = r1, mr2 = r2, mc1 = c1, mc2 = c2;

			for(let r=r1; r<=r2; r++) {
				for(let c=c1; c<=c2; c++) {
					const cell = this.findCell(r, c);
					const cc = this._getCoords(cell);
					mr1 = Math.min(mr1, cc.r1);
					mr2 = Math.max(mr2, cc.r2);
					mc1 = Math.min(mc1, cc.c1);
					mc2 = Math.max(mc2, cc.c2);
				}
			}

			return {r1: mr1, r2: mr2, c1: mc1, c2: mc2};
		}

		const { r1, c1, r2, c2 } = expandRange(cell1, cell2);

		this.clearSelection();
		let valid = true;

		Array.from(this.table.rows).forEach(row=> {
			Array.from(row.cells).forEach(cell=> {
				const cc = this._getCoords(cell);

				let some = false;   // 部分包含？
				let all = true;     // 全部包含？

				// 被包含元素必须被完整包含。
				for(let i=cc.r1; i<=cc.r2; i++) {
					for(let j=cc.c1; j<=cc.c2; j++) {
						const within = r1 <= i && i <= r2 && c1 <= j && j <= c2;
						some |= within;
						all  &= within;
					}
				}

				if(some) {
					if(all) {
						this._highlight(cell, true);
						this.selectedCells.push(cell);
					} else {
						valid = false;
					}
				}
			});
		});

		if(!valid) {
			this.clearSelection();
		}

		return valid;
	}

	/**
	 * 
	 * @param {Number} row 
	 * @param {Number} col 
	 */
	selectCell(row, col) {
		const cell = this.findCell(row, col);
		this._selectCell(cell, true);
		return cell;
	}

	/** @param {HTMLTableCellElement} col */
	_selectCell(cell, force) {
		if(!force && cell == this.curCell) {
			if(this._isEditing(cell)) return;
			else return this.clearSelection();
		}

		if(this.curCell) {
			this._highlight(this.curCell, false);
			this._edit(this.curCell, false);
		}

		this.clearSelection();

		this.curCell = cell;
		this._highlight(cell, true);
	}

	clearSelection() {
		if(this.curCell) {
			this._highlight(this.curCell, false);
			this._edit(this.curCell, false);
		}
		this.curCell = null;
		this.selectedCells.forEach(cell => {
			this._highlight(cell, false);
			this._edit(cell, false);
		})
		this.selectedCells = [];
	}

	/**
	 * 
	 * @param {HTMLTableCellElement} cell 
	 * @param {boolean} on 
	 */
	_highlight(cell, on) {
		if(on) cell.classList.add('selected');
		else {
			cell.classList.remove('selected');
			cell.className == "" && cell.removeAttribute('class');
		}
	}

	/**
	 * 
	 * @param {HTMLTableCellElement} cell 
	 * @returns {boolean}
	 */
	_isSelected(cell) {
		return cell.classList.contains('selected');
	}

	/**
	 * 
	 * @param {HTMLTableCellElement} cell 
	 * @param {boolean} on 
	 */
	_edit(cell, on) {
		if(on) {
			cell.contentEditable = 'plaintext-only';
			cell.classList.add('editing');
			cell.focus();

			if(this._fixLineHeight) {
				if(cell._fixing) {
					if(cell.innerHTML == '\u200b') {
						cell.textContent = '';
					}
					cell._fixing = false;
				}
			}

			// 保存旧内容，对比并判断是否需要进栈。
			cell._data = cell.textContent;

			const range = document.createRange();
			range.selectNodeContents(cell);
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		} else {
			// 如果正在编辑（而不是重复取消编辑），则说明可能内容需要保存。
			if (!this._isEditing(cell)) { return }
			if(typeof cell._data == 'string' && cell.textContent != cell._data) {
				this._save();
			}

			cell.removeAttribute('contentEditable');
			cell.classList.remove('editing');
			cell.className == "" && cell.removeAttribute('class');
			// 会不会有误清除？
			window.getSelection().removeAllRanges();
		}
	}

	/**
	 * 
	 * @param {HTMLTableCellElement} cell 
	 * @returns {Boolean}
	 */
	_isEditing(cell) {
		return cell.classList.contains('editing');
	}

	/** @returns {HTMLTableCellElement | null} */
	findCell(r,c) {
		let ret = null;
		this._forEachCell(cell => {
			const cc = this._getCoords(cell);
			if(cc.r1 <= r && r <= cc.r2 && cc.c1 <= c && c <= cc.c2) {
				ret = cell;
				return;
			}
		});
		return ret;
	}

	toHeaderRows() { return this._toCells(true,  'TD', 'TH'); }
	toHeaderCols() { return this._toCells(false, 'TD', 'TH'); }
	toDataRows()   { return this._toCells(true,  'TH', 'TD'); }
	toDataCols()   { return this._toCells(false, 'TH', 'TD'); }

	_toCells(byRow, from, to) {
		const selected = [...this.selectedCells];
		if(this.curCell) selected.push(this.curCell);
		if (selected.length <= 0) {
			alert('Please select at least one cell.');
			return false;
		}

		// 扩展选区到包含完整的行/列。
		const maxCols = this._maxCols(), maxRows = this.table.rows.length;
		let r1,r2,c1,c2;
		if(byRow) {
			c1 = 1; c2 = maxCols;
			r1 = maxRows; r2 = 1;
			selected.forEach(cell => {
				const cc = this._getCoords(cell);
				r1 = Math.min(r1, cc.r1);
				r2 = Math.max(r2, cc.r2);
			});
		} else {
			r1 = 1; r2 = maxRows;
			c1 = maxCols; c2 = 1;
			selected.forEach(cell => {
				const cc = this._getCoords(cell);
				c1 = Math.min(c1, cc.c1);
				c2 = Math.max(c2, cc.c2);
			});
		}

		const clone = (cell, tag) => {
			/** @type {HTMLTableCellElement} */
			const replaced = document.createElement(tag);
			replaced.innerHTML = cell.innerHTML;
			if (cell.rowSpan > 1) replaced.rowSpan = cell.rowSpan;
			if (cell.colSpan > 1) replaced.colSpan = cell.colSpan;
			this._setCoords(replaced, this._getCoords(cell));
			return replaced;
		}

		for(let r=r1; r<=r2; r++) {
			for(let c=c1; c<=c2; c++) {
				const cell = this.findCell(r, c);
				if(cell.tagName == from) {
					cell.replaceWith(clone(cell, to));
				}
			}
		}

		this.clearSelection();
		this._save();
	}

	addRowAbove() { return this._addRow('above'); }
	addRowBelow() { return this._addRow('below'); }

	_addRow(position) {
		if (!this.curCell) {
			alert('Please select a cell first.');
			return;
		}

		/** @type {HTMLTableRowElement} */
		const row = this.curCell.parentElement;
		const curCell = this.curCell;

		// 计算待插入行的逻辑行号。
		// 初始化为上方（above）插入。
		// 如果是下方，需要根据 rowspan 计算。
		let newRowIndex = position == 'above' 
			? row.rowIndex
			: row.rowIndex + curCell.rowSpan;

		// 如果上方或正文的行没有 colspan，则 maxCols 代表本来应该插入的列数。
		// 但是实际可能存在 colspan 和 rowspan，插入数量需要重新计算（更少）。
		const maxCols = this._maxCols();

		// 如果是第一行或最后一行，则不需要计算。
		if (newRowIndex == 0 || newRowIndex == this.table.rows.length) {
			const tr = this.table.insertRow(newRowIndex);
			for(let i=0; i<maxCols; i++) {
				tr.insertCell();
			}
		} else {
			// const refRow = this.table.rows[newRowIndex];
			// 计算待插入行的实际构成。

			let insertCount = 0;

			for(let i=0; i<maxCols; /*i++*/) {
				const rr = newRowIndex+1, rc = i+1;
				const cell = this.findCell(rr, rc);
				const cc = this._getCoords(cell);
				// 该单元格由自己组成。
				if(cc.r1 == cc.r2) {
					insertCount++;
					i += 1;
					continue;
				}
				// 由上面单元格的最下面的构成 || 由下面单元格的最上面的构成。
				if (position == 'above' && (cc.r1 == rr /*|| cc.r2 == rr*/) || position == 'below' && (cc.r1 == rr)) {
					insertCount++;
					i += 1;
					continue;
				}
				// 其它情况：扩展原有单元格。
				cell.rowSpan += 1;
				i += cell.colSpan;
			}

			const tr = this.table.insertRow(newRowIndex);
			for(let i=0; i<insertCount; i++) {
				tr.insertCell();
			}
		}

		this._calcCoords();
		this._save();
	}

	addColLeft()  { return this._addCol('left');  }
	addColRight() { return this._addCol('right'); }

	/** @param {string} position  */
	_addCol(position) {
		if (!this.curCell) {
			alert('Please select a cell first.');
			return;
		}

		/** @type {HTMLTableCellElement} */
		const cell = this.curCell;
		const cc = this._getCoords(cell);

		// 如果是第一列，不需要计算。
		// 如果是最后一列，直接追加。
		if (cc.c1 == 1 && position == 'left' || cc.c2 == this._maxCols() && position == 'right') {
			const rows = this.table.rows.length;
			for(let i=0; i<rows; i++) {
				const row = this.table.rows[i];
				row.insertCell(position=='left' ? 0 : -1);
			}
			this._calcCoords();
			this._save();
			return;
		}

		const left = position == 'left';
		const newColIndex = left ? cc.c1 - 1 : cc.c2;

		const rows = this.table.rows.length;
		for(let i=0; i<rows; i++) {
			const row = this.table.rows[i];
			const rr = i+1, rc = newColIndex+1;
			const cell = this.findCell(rr, rc);
			const cc = this._getCoords(cell);

			// 单元格由自己组成。
			if(cc.c1 == rc) {
				let pos = cell.cellIndex;
				// 上面插入过
				if(cell.rowSpan > 1 && i+1 != cc.r1) {
					pos--;
				}
				const td = row.insertCell(pos);
				this._setCoords(td, {
					r1: rr, c1: rc,
					r2: rr, c2: rc,
				});
				continue;
			}

			// 单元格由合并单元格组成，并且当前处在合并单元格的第一行。
			if(cc.r1 == i+1 && cc.c1 != rc) {
				cell.colSpan++;
				continue;
			}
		}

		this._calcCoords();
		this._save();
	}

	/**
	 * 在拆分单元格时，转移数据。
	 * @param {HTMLTableCellElement} from 
	 * @param {HTMLTableCellElement} to 
	 */
	_copyCellData(from, to) {
		to.innerHTML = from.innerHTML;
	}

	deleteRows() {
		const rows = [];
		if (this.curCell) {
			const cc = this._getCoords(this.curCell);
			for(let i=cc.r1; i<=cc.r2; i++) {
				rows.push(i);
			}
		} else if(this.selectedCells?.length > 0) {
			this.selectedCells.forEach(cell => {
				const cc = this._getCoords(cell);
				for(let i=cc.r1; i<=cc.r2; i++) {
					rows.push(i);
				}
			});
		}

		// descending
		const sorted = [...new Set(rows)].sort((a,b) => b-a);
		// console.log('deleteRows:', sorted);

		const maxCols = this._maxCols();
		sorted.forEach(r => {
			for(let c=1; c <= maxCols;) {
				const cell = this.findCell(r, c);
				const cc = this._getCoords(cell);
				const rowSpan = cell.rowSpan;
				// 单行元素。
				if (rowSpan == 1) {
					c += cell.colSpan;
					continue;
				}
				// 向下展开。
				if (r == cc.r1) {
					this.selectCell(r, c);

					// 均不进栈。
					this._split();

					// 拆分后坐标会刷新，可以正确找到下一个。
					const below = this.findCell(r+1,c);
					this._copyCellData(cell, below);

					// 把拆分了的再合并起来。
					const r1 = r+1;
					const r2 = (r+1)+(rowSpan-1)-1;
					const c1 = c;
					const c2 = c+cell.colSpan-1;
					// 拆分后仍然是多行/多列。
					if(r1 != r2 || c1 != c2) {
						this.selectRange(r1, c1, r2, c2);
						this._merge();
					}

					c += cell.colSpan;
					continue;
				}
				// 来自上面。
				cell.rowSpan--;
				c += cell.colSpan;
			}
			this.table.deleteRow(r - 1);
			this._calcCoords();
		});

		this.clearSelection();
		this._calcCoords();
		this._save();
	}

	deleteCols() {
		const cols = [];
		if (this.curCell) {
			const cc = this._getCoords(this.curCell);
			for(let i=cc.c1; i<=cc.c2; i++) {
				cols.push(i);
			}
		} else if(this.selectedCells?.length > 0) {
			this.selectedCells.forEach(cell => {
				const cc = this._getCoords(cell);
				for(let i=cc.c1; i<=cc.c2; i++) {
					cols.push(i);
				}
			});
		}

		// descending
		const sorted = [...new Set(cols)].sort((a,b) => b-a);
		// console.log('deleteCols:', sorted);

		const rows = this.table.rows.length;
		sorted.forEach(c => {
			const toRemove = [];
			for(let r=1; r <= rows;) {
				const cell = this.findCell(r, c);
				const cc = this._getCoords(cell);
				const rowSpan = cell.rowSpan;
				const colSpan = cell.colSpan;
				// 单列元素。
				if (colSpan == 1) {
					r += rowSpan;
					toRemove.push(cell);
					continue;
				}
				// 向右展开。
				if(c == cc.c1) {
					this.selectCell(r, c);

					// 不进栈。
					this._split();

					// 拆分后坐标会刷新，可以正确找到右一个。
					const right = this.findCell(r,c+1);
					this._copyCellData(cell, right);

					// 把拆分了的再合并起来。
					const r1 = r;
					const c1 = c+1;
					const r2 = r1 + rowSpan - 1;
					const c2 = c1 + colSpan-1 - 1;
					if(r1 != r2 || c1 != c2) {
						this.selectRange(r1, c1, r2, c2);
						this._merge();
					}

					// 修改过需要重新计算。
					this._calcCoords();

					// 拆分过了，只剩 1 行
					r += 1;
					toRemove.push(cell);
					continue;
				}
				// 来自左边。
				cell.colSpan--;
				r += rowSpan;
			}
			toRemove.forEach(cell => cell.remove());
		});

		this.clearSelection();
		this._calcCoords();
		this._save();
	}

	merge() {
		if(this._merge()) {
			this._save();
		}
	}
	_merge() {
		if(this.selectedCells.length < 2) {
			alert('Please select at least two cells to merge.');
			return false;
		}

		const firstCell = this.selectedCells[0];

		// 找最右最下的元素，并非一定是最后一个元素。
		// const lastCell = this.selectedCells[this.selectedCells.length - 1];

		let lastCell = firstCell;

		const firstCoords = this._getCoords(firstCell);
		let lastCoords = this._getCoords(lastCell);

		this.selectedCells.forEach(cell => {
			const cc = this._getCoords(cell);
			if (cc.r2 >= lastCoords.r2 && cc.c2 >= lastCoords.c2) {
				lastCell = cell;
				lastCoords = this._getCoords(lastCell);
			}
		});

		const rowSpan = lastCoords.r2 - firstCoords.r1 + 1;
		const colSpan = lastCoords.c2 - firstCoords.c1 + 1;

		// 移除所有其它元素。以第一个为合并标准。它总是位于最左上角位置，即第一个元素。
		for(let i=1; i<this.selectedCells.length; i++) {
			const cell = this.selectedCells[i];
			cell.remove();
		}

		if (rowSpan > 1) {
			firstCell.rowSpan = rowSpan;
		} else {
			firstCell.removeAttribute('rowspan');
		}
		if (colSpan > 1) {
			firstCell.colSpan = colSpan;
		} else {
			firstCell.removeAttribute('colspan');
		}

		// 合并后把当前单元格设置为第一个单元格。
		this._selectCell(firstCell, true);

		this._calcCoords();

		return true;
	}

	split() {
		if(this._split()) {
			this._save();
		}
	}

	/**
	 * 
	 * @param {boolean} save deleteCols / deleteRows 会调用，为了使 undo 栈只进 1，不 save。
	 * @returns 
	 */
	_split() {
		if (!this.curCell) {
			alert('Please select a cell first.');
			return false;
		}

		const cell = this.curCell;
		if(cell.rowSpan == 1 && cell.colSpan == 1) {
			alert('not a merged cell');
			return false;
		}

		const cc = this._getCoords(cell);
		const c1 = cc.c1;
		const rowCellIndices = [];
		// 每行都需要添加一个单元格。
		for(let i=cc.r1; i<=cc.r2; i++) {
			const row = this.table.rows[i-1];
			if(c1 == 1) {
				for(let k=0; k<cell.colSpan; k++) {
					// 最左上角的
					if(i==cc.r1 && k==0) {
						continue;
					}
					row.insertCell(k);
				}
				continue;
			}
			// 单元格可能是上面 rowspan 的的，需要向前找到第一个起始行为当前行的。
			for(let j=c1-1; j>=1; j--) {
				const left = this.findCell(i, j);
				const cl = this._getCoords(left);
				// 从上面挤下来的，或者左边还有元素。
				if(cl.r1 != i && cl.c1 > 1) {
					continue;
				}
				const cellIndices = [];
				for(let k=0; k<cell.colSpan; k++) {
					// 最左上角的
					if(i==cc.r1 && k==0) {
						continue;
					}
					const index = cl.r1 == i ? left.cellIndex+k+1 : k;
					cellIndices.push(index);
				}
				rowCellIndices.push(cellIndices);
				break;
			}
		}

		rowCellIndices.forEach((indices,relativeRowIndex) => {
			const realRowIndex = cc.r1 - 1 + relativeRowIndex;
			const row = this.table.rows[realRowIndex];
			indices.forEach(colIndex => {
				row.insertCell(colIndex);
			});
		});

		cell.removeAttribute('colspan');
		cell.removeAttribute('rowspan');

		this._calcCoords();

		return true;
	}

	/**
	 * 移动指定位置的列到指定位置。
	 * @param {number} from     源列号（从 1 开始）。
	 * @param {number} count    列数。
	 * @param {number} to       目的列号。原来处于 to 位置的向右挤。
	 */
	moveCols(from, count, to) {
		if(!this._canMoveCols(from, count, to)) {
			throw new Error('cannot move cols');
		}

		const c1 = from, c2 = from + count - 1;
		const rows = this.table.rows.length;
		const maxCols = this._maxCols();

		/**
		 * 查找 to 左边的元素。
		 * @param {number} r 
		 * @param {number} to 
		 * @returns {HTMLTableCellElement | null}
		 */
		const findLeft = (r, to) => {
			for (; to >= 1; ) {
				if(to == 1) { return null; }
				if(to == maxCols+1) { return this.table.rows[r-1].lastElementChild; }
				const cell = this.findCell(r, to-1);
				const cc = this._getCoords(cell);
				if(cc.c1 == to-1 && cc.r1 == r) {
					return cell;
				}
				to--;
			}
			throw new Error('bad to for col');
		};
		const rowsToMove = [];
		for(let r = 1; r <= rows; r++) {
			let cellsToMove = [];
			let noMove = false;
			for(let c = c1; c <= c2; c++) {
				const cell = this.findCell(r, c);
				const cc = this._getCoords(cell);
				// 左上角单元格/独立单元格。
				if(cc.c1 == c && cc.r1 == r) {
					// 如果 to 在此范围内说明此列需保持不动。
					if (to >= cc.c1 && to <= cc.c2+1) {
						noMove = true;
						break;
					}
					cellsToMove.push(cell);
				}
			}
			if(noMove) {
				rowsToMove.push({cellsToMove});
			} else {
				const left = findLeft(r, to);
				rowsToMove.push({left, cellsToMove});
			}
		}
		for(let r = 1; r <= rows; r++) {
			const row = this.table.rows[r - 1];
			const data = rowsToMove[r-1];
			let left = data.left;
			data.cellsToMove.forEach(cell => {
				if(!left) { row.insertAdjacentElement('afterbegin', cell); }
				else { left.insertAdjacentElement('afterend', cell); }
				left = cell;
			});
		}

		this._calcCoords();
		this._save();

		return true;
	}

	/**
	 * @param {number} from     
	 * @param {number} count    
	 * @param {number} to       
	 */
	_canMoveCols(from, count, to) {
		const c1 = from, c2 = from + count - 1;
		const maxCols = this._maxCols();
		if(
			(c1 < 1 || c2 > maxCols || c1 > c2)     // 源列号无效
			|| (to < 1 || to > maxCols + 1)         // 目标列号无效
			|| (c1 <= to && to <= c2)               // 有重合
			|| (c2+1 == to)                         // 原地
		) {
			return false;
		}

		// 判断选择列的数据没有跨越到其它列。
		const rows = this.table.rows.length;
		for(let c = c1; c <= c2; c++) {
			for(let r = 1; r <= rows;) {
				const cell = this.findCell(r, c);
				const cc = this._getCoords(cell);
				// 列来自左边，或者跨越到了右边。
				if(cc.c1 < c1 || cc.c2 > c2) {
					// 此种情况属于有不动列的情况，to 必须在该列内包含。
					if(to < cc.c1 || to > cc.c2+1) {
						return false;
					}
				}
				r += cell.rowSpan;
			}
		}

		// 判断目标列。
		if(to != maxCols+1) {
			// 且目标列只有一列或者不处在里面。
			for(let r = 1; r <= rows; r++) {
				const cell = this.findCell(r, to);
				const cc = this._getCoords(cell);
				// 如果有横跨列，
				if(cell.colSpan > 1) {
					// 如果源列在内，那么目标列也必须包含在内。
					// 如果源列不在内，那么目标列也不应该包含在内。
					const fromWithin = c1 >= cc.c1 && c2 <= cc.c2;
					const toValid1 =  fromWithin && (to >= cc.c1 && to <= cc.c2+1);
					const toValid2 = !fromWithin && (to <= cc.c1 || to >= cc.c2+1);
					if(!toValid1 && !toValid2) {
						return false;
					}
				}
			}
		}

		return true;
	}

	/**
	 * 移动 {from,count} 位置的行到 {to} 位置。
	 * @param {number} from     源行号（从 1 开始）
	 * @param {number} count    行数
	 * @param {number} to       目的行号。原来处于 to 位置的向下挤。
	 */
	moveRows(from, count, to) {
		if (!this._canMoveRows(from, count, to)) {
			throw new Error('cannot move rows');
		}

		const r1 = from, r2 = from + count - 1;
		const maxRows = this.table.rows.length;
		const maxCols = this._maxCols();

		// 找出所有包含了源行、目标行、且跨行的单元格。
		// 如果移动行，且包含了它们首行，则需要调整跨行单元格的位置。
		/** @type {NodeListOf<HTMLTableCellElement>} */
		const edgeCells = [];
		for(let r=r1; r<=r2; r++) {
			for(let c=1; c<=maxCols; c++) {
				const cell = this.findCell(r, c);
				const cc = this._getCoords(cell);
				// 移动的行是首行，或者是目标行，则都需要调整位置。
				if (cell.rowSpan > 1 && ((cc.r1 == r && cc.r1 == r1) || cc.r1 == to) && (to >= cc.r1 && to <= cc.r2+1)) {
					edgeCells.push(cell);
				}
			}
		}
		if(edgeCells.length > 0) {
			/**
			 * 查找 to 左边的元素。
			 * @param {number} r 
			 * @param {number} c
			 * @returns {HTMLTableCellElement | null}
			 */
			const findLeft = (r1, r, c) => {
				for(let x=c; x>=1; x--) {
					if(x == 1) {
						return null;
					}
					const left = this.findCell(r, x-1);
					if(left.rowSpan == 1) {
						return left;
					}
					// 如果左边的这个元素跟自己同行，则说明也要被移动。
					const cc = this._getCoords(left);
					if (cc.r1 == r1) {
						return left;
					}
				}
			};

			// 如果是首行下移，跨行的被移动到下一行；
			// 如果是首行成为目标行，跨行的移动到目标行。
			let newFirstRow = to > r2 ? r2+1 : r1;

			// 找到跨行单元格在新的行的真实位置。
			// 通过寻找在原来行的位置来确定。
			/**
			 * @typedef {Object} OldPos
			 * @property {HTMLTableCellElement} cell
			 * @property {HTMLTableCellElement} left
			 */
			/** @type {OldPos[]} */
			const oldPos = [];
			edgeCells.forEach(cell => {
				const cc = this._getCoords(cell);
				const left = findLeft(r1, newFirstRow, cc.c1);
				oldPos.push({cell, left});
			});

			// 把需要移动的单元格移动到新的行里面去。
			const toRow = this.table.rows[newFirstRow-1];
			/** @type {HTMLTableCellElement} */
			let left = null;
			oldPos.forEach(data => {
				if(!data.left) {
					if(!left) {
						toRow.insertAdjacentElement('afterbegin', data.cell);
						left = data.cell;
					} else {
						left.insertAdjacentElement('afterend', data.cell);
					}
				} else {
					data.left.insertAdjacentElement('afterend', data.cell);
				}
			});
		}

		const rowsToMove = Array.from(this.table.rows).slice(r1-1, r2+1-1);
		if(to == maxRows+1) {
			rowsToMove.forEach(r => {
				const last = this.table.rows[maxRows-1];
				last.insertAdjacentElement('afterend', r);
			});
		} else {
			const row = this.table.rows[to - 1];
			rowsToMove.forEach(r => row.insertAdjacentElement('beforebegin', r));
		}

		this._calcCoords();
		this._save();

		return true;
	}

	/**
	 * @param {number} from     
	 * @param {number} count    
	 * @param {number} to       
	 */
	_canMoveRows(from, count, to) {
		const r1 = from, r2 = from + count - 1;
		const maxRows = this.table.rows.length;
		const maxCols = this._maxCols();
		
		if(
			(r1 < 1 || r2 > maxRows || r1 > r2)     // 源行号无效
			|| (to < 1 || to > maxRows + 1)         // 目标行号无效
			|| (r1 <= to && to <= r2)               // 有重合
			|| (r2+1 == to)                         // 原地
		) {
			return false;
		}

		// 判断选择行的数据没有跨越到其它行。
		for(let r=r1; r<=r2; r++) {
			for(let c=1; c<=maxCols; c++) {
				const cell = this.findCell(r, c);
				const cc = this._getCoords(cell);
				// 行来自上面，或者跨越到了下面。
				if(cc.r1 < r1 || cc.r2 > r2) {
					// 此种情况属于有不动行的情况，to 必须在该行内包含。
					if(to < cc.r1 || to > cc.r2+1) {
						return false;
					}
				}
			}
		}

		// 判断目标行。
		// 目标行只有一行或者不处在里面。
		if(to != maxRows+1) {
			for(let c=1; c<= maxCols; c++) {
				const cell = this.findCell(to, c);
				const cc = this._getCoords(cell);
				// 如果有纵跨行...
				if(cell.rowSpan > 1) {
					// 如果源行在内，那么目标行也必须包含在内。
					// 如果源行不在内，那么目标行也不应该包含在内。
					const fromWithin = r1 >= cc.r1 && r2 <= cc.r2;
					const toValid1 =  fromWithin && (to >= cc.r1 && to <= cc.r2+1);
					const toValid2 = !fromWithin && (to <= cc.r1 || to >= cc.r2+1);
					if(!toValid1 && !toValid2) {
						return false;
					}
				}
			}
		}

		return true;
	}

	// TODO 由于列数总是一致的，所以取第一行的最后一列即可，无需判断所有行。
	_maxCols() {
		let maxCol = 0;
		Array.from(this.table.rows).forEach(row=> {
			Array.from(row.cells).forEach(cell=> {
				const cc = this._getCoords(cell);
				maxCol = Math.max(maxCol, cc.c2);
			});
		});
		return maxCol;
	}

	_calcCoords(debug = false) {
		// debugger;
		let calcC1 = (rowIndex, colIndex) => {
			let retry = (tr, tc) => {
				for(let x=0; x <= rowIndex; x++) {
					const cols = this.table.rows[x].cells.length;
					for(let y=0; y < cols; y++) {
						if(x == rowIndex && y == colIndex) {
							return tc;
						}
						const cc = this._getCoords(this.table.rows[x].cells[y]);
						if (cc.r1 <= tr && tr <= cc.r2 && cc.c1 <= tc && tc <= cc.c2) {
							tc++;
							return retry(tr, tc);
						}
					}
				}
			};

			const tr = rowIndex + 1;
			let tc = colIndex + 1;

			return retry(tr, tc);
		};

		Array.from(this.table.rows).forEach((row, rowIndex) => {
			Array.from(row.cells).forEach((col, colIndex) => {
				const p = {};

				p.r1 = rowIndex + 1;
				p.c1 = calcC1(rowIndex, colIndex);

				if(col.rowSpan == 0) {
					p.r2 = p.r1;
				} else {
					p.r2 = +p.r1 + col.rowSpan - 1;
				}

				if(col.colSpan == 0) {
					p.c2 = p.c1;
				} else {
					p.c2 = +p.c1 + col.colSpan - 1;
				}

				this._setCoords(col, p);

				if(debug) col.textContent = `${p.r1},${p.c1}`;
			});
		});
	}
}

class TableTest {
	constructor() {
		/**
		 * @type {{ note: string, init: (t: Table) => void, html: string, error: string }[]}
		 */
		this.cases = [
			{
				init: t => { t.reset(2,2); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td></tr><tr><td>2,1</td><td>2,2</td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(2,2); t.selectCell(1,2); },
				html: '<table><tbody><tr><td>1,1</td><td class="selected">1,2</td></tr><tr><td>2,1</td><td>2,2</td></tr></tbody></table>',
			},
			{
				note: '选区：↗️',
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.selectRange(2,1,1,2); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td class="selected">1,2</td></tr><tr><td class="selected">2,2</td></tr></tbody></table>',
			},
			{
				note: '插入行：向上',
				init: t => { t.reset(2,2); t.selectCell(1,1); t.addRowAbove(); },
				html: '<table><tbody><tr><td></td><td></td></tr><tr><td class="selected">1,1</td><td>1,2</td></tr><tr><td>2,1</td><td>2,2</td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); },
				html: '<table><tbody><tr><td>1,1</td><td rowspan="2" class="selected">1,2</td></tr><tr><td>2,1</td></tr></tbody></table>',
			},
			{
				note: '插入行：内部包含合并',
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); t.selectCell(1,1); t.addRowAbove(); t.addRowBelow(); },
				html:  '<table><tbody><tr><td></td><td></td></tr><tr><td class="selected">1,1</td><td rowspan="3">1,2</td></tr><tr><td></td></tr><tr><td>2,1</td></tr></tbody></table>',
			},
			{
				note: '插入列：在合并列的右边',
				init: t => { t.reset(2,1); t.selectRange(1,1,2,1); t.merge(); t.addColRight(); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td></td></tr><tr><td></td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(2,2); t.selectRange(1,2,2,2); t.merge(); t.addColLeft(); },
				html: '<table><tbody><tr><td>1,1</td><td></td><td rowspan="2" class="selected">1,2</td></tr><tr><td>2,1</td><td></td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.selectCell(2,2); t.addColLeft(); },
				html: '<table><tbody><tr><td rowspan="3">1,1</td><td></td><td>1,2</td></tr><tr><td></td><td class="selected">2,2</td></tr><tr><td></td><td>3,2</td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.selectCell(2,2); t.addColRight(); t.selectRange(2,2,2,3); t.merge(); t.addColLeft(); },
				html: '<table><tbody><tr><td rowspan="3">1,1</td><td></td><td>1,2</td><td></td></tr><tr><td></td><td colspan="2" class="selected">2,2</td></tr><tr><td></td><td>3,2</td><td></td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.selectCell(1,2); t.addColLeft(); },
				html: '<table><tbody><tr><td>1,1</td><td></td><td class="selected">1,2</td><td>1,3</td></tr><tr><td>2,1</td><td></td><td rowspan="2" colspan="2">2,2</td></tr><tr><td>3,1</td><td></td></tr></tbody></table>',
			},
			{
				note: '合并并拆分',
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.split(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td>1,3</td></tr><tr><td>2,1</td><td class="selected">2,2</td><td></td></tr><tr><td>3,1</td><td></td><td></td></tr></tbody></table>',
			},
			{
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.selectRange(1,2,2,2);  t.merge(); t.split(); },
				html: '<table><tbody><tr><td rowspan="2">1,1</td><td class="selected">1,2</td></tr><tr><td></td></tr></tbody></table>',
			},
			{
				note: '删除行，单行元素',
				init: t => { t.reset(3,3); t.selectCell(1,2); t.deleteRows(); },
				html: '<table><tbody><tr><td>2,1</td><td>2,2</td><td>2,3</td></tr><tr><td>3,1</td><td>3,2</td><td>3,3</td></tr></tbody></table>',
			},
			{
				note: '删除行，多行元素，来自上面',
				init: t => { t.reset(3,3); t.selectRange(1,2,3,2); t.merge(); t.selectCell(3,1); t.deleteRows(); },
				html: '<table><tbody><tr><td>1,1</td><td rowspan="2">1,2</td><td>1,3</td></tr><tr><td>2,1</td><td>2,3</td></tr></tbody></table>',
			},
			{
				note: '删除行，多行元素，向下展开',
				init: t => { t.reset(3,3); t.selectRange(1,2,3,2); t.merge(); t.selectCell(1,1); t.deleteRows(); },
				html: '<table><tbody><tr><td>2,1</td><td rowspan="2">1,2</td><td>2,3</td></tr><tr><td>3,1</td><td>3,3</td></tr></tbody></table>',
			},
			{
				note: '删除行，重新计算坐标',
				init: t => { t.reset(3,3); t.selectRange(1,3,3,3); t.merge(); t.selectRange(1,1,2,1); t.deleteRows(); },
				html: '<table><tbody><tr><td>3,1</td><td>3,2</td><td>1,3</td></tr></tbody></table>',
			},
			{
				note: '删除行，自动合并',
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.selectCell(1,2); t.deleteRows(); },
				html: '<table><tbody><tr><td rowspan="2">1,1</td><td>2,2</td></tr><tr><td>3,2</td></tr></tbody></table>',
			},
			{
				note: '删除列，单列元素',
				init: t => { t.reset(3,3); t.selectCell(1,2); t.deleteCols(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,3</td></tr><tr><td>2,1</td><td>2,3</td></tr><tr><td>3,1</td><td>3,3</td></tr></tbody></table>',
			},
			{
				note: '删除列，多列元素，来自左边',
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.selectCell(1,3); t.deleteCols(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td></tr><tr><td>2,1</td><td rowspan="2" colspan="1">2,2</td></tr><tr><td>3,1</td></tr></tbody></table>',
			},
			{
				note: '删除列，多列元素，向右展开',
				init: t => { t.reset(3,3); t.selectRange(2,2,3,3); t.merge(); t.selectCell(1,2); t.deleteCols(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,3</td></tr><tr><td>2,1</td><td rowspan="2">2,2</td></tr><tr><td>3,1</td></tr></tbody></table>',
			},
			{
				note: '删除列，自动合并',
				init: t => { t.reset(3,3); t.selectRange(1,1,1,3); t.merge(); t.selectCell(2,1); t.deleteCols(); },
				html: '<table><tbody><tr><td colspan="2">1,1</td></tr><tr><td>2,2</td><td>2,3</td></tr><tr><td>3,2</td><td>3,3</td></tr></tbody></table>',
			},
			{
				note: '移动列',
				init: t => { t.reset(4,4); t.selectRange(2,2,2,3); t.merge(); t.selectRange(3,1,4,1); t.merge(); t.selectRange(3,3,4,3); t.merge(); t.clearSelection(); t.moveCols(2,3,1); },
				html: '<table><tbody><tr><td>1,2</td><td>1,3</td><td>1,4</td><td>1,1</td></tr><tr><td colspan="2">2,2</td><td>2,4</td><td>2,1</td></tr><tr><td>3,2</td><td rowspan="2">3,3</td><td>3,4</td><td rowspan="2">3,1</td></tr><tr><td>4,2</td><td>4,4</td></tr></tbody></table>',
			},
			{
				note: '移动列：和首列交换',
				init: t => { t.reset(1,4); t.moveCols(2,1,1); t.moveCols(3,1,2); },
				html: '<table><tbody><tr><td>1,2</td><td>1,3</td><td>1,1</td><td>1,4</td></tr></tbody></table>',
			},
			{
				note: '移动列：固定表头',
				init: t => { t.reset(3,3); t.selectRange(1,2,1,3); t.merge(); t.moveCols(2,1,4); },
				html:  '<table><tbody><tr><td>1,1</td><td colspan="2" class="selected">1,2</td></tr><tr><td>2,1</td><td>2,3</td><td>2,2</td></tr><tr><td>3,1</td><td>3,3</td><td>3,2</td></tr></tbody></table>',
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
			},
			{
				note: '移动行',
				init: t => { t.reset(4,3); t.selectRange(3,2,4,3); t.merge(); t.moveRows(3,2,2); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td>1,3</td></tr><tr><td>3,1</td><td rowspan="2" colspan="2" class="selected">3,2</td></tr><tr><td>4,1</td></tr><tr><td>2,1</td><td>2,2</td><td>2,3</td></tr></tbody></table>',
			},
			{
				note: '移动行：包含多行',
				init: t => { t.reset(3,2); t.selectRange(1,1,2,1); t.merge(); t.moveRows(1,2,4); },
				html: '<table><tbody><tr><td>3,1</td><td>3,2</td></tr><tr><td rowspan="2" class="selected">1,1</td><td>1,2</td></tr><tr><td>2,2</td></tr></tbody></table>',
			},
			{
				note: '移动行：包含多行，同时两行',
				init: t => { t.reset(3,2); t.selectRange(1,1,3,1); t.merge(); t.moveRows(1,2,4); },
				html: '<table><tbody><tr><td rowspan="3" class="selected">1,1</td><td>3,2</td></tr><tr><td>1,2</td></tr><tr><td>2,2</td></tr></tbody></table>',
			},
			{
				note: '移动行：多行内移动，下移',
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td>2,2</td></tr><tr><td>1,2</td></tr></tbody></table>',
			},
			{
				note: '移动行：多行内移动，上移',
				init: t => { t.reset(2,2); t.selectRange(1,1,2,1); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td rowspan="2" class="selected">1,1</td><td>2,2</td></tr><tr><td>1,2</td></tr></tbody></table>',
			},
			{
				note: '移动行：多行内移动，多个跨行',
				init: t => { t.reset(4,3); t.selectRange(1,1,4,1); t.merge(); t.selectRange(2,2,3,2); t.merge(); t.moveRows(2,1,4); },
				html: '<table><tbody><tr><td rowspan="4">1,1</td><td>1,2</td><td>1,3</td></tr><tr><td rowspan="2" class="selected">2,2</td><td>3,3</td></tr><tr><td>2,3</td></tr><tr><td>4,2</td><td>4,3</td></tr></tbody></table>',
			},
			{
				note: '移动行：多行内移动，跨行在右边',
				init: t => { t.reset(3,2); t.selectRange(1,2,3,2); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td>2,1</td><td rowspan="3" class="selected">1,2</td></tr><tr><td>1,1</td></tr><tr><td>3,1</td></tr></tbody></table>',
			},
			{
				note: '移动行：多行内移动，跨行在右边，两列',
				init: t => { t.reset(2,3); t.selectRange(1,2,2,2); t.merge(); t.selectRange(1,3,2,3); t.merge(); t.moveRows(1,1,3); },
				html: '<table><tbody><tr><td>2,1</td><td rowspan="2">1,2</td><td rowspan="2" class="selected">1,3</td></tr><tr><td>1,1</td></tr></tbody></table>',
			},
			{
				note: '撤销：不双重保存，因为内部调用了 split（原本也会再自己 save 一次）',
				init: t => { t.reset(3,3); t.selectRange(1,3,3,3); t.merge(); t.selectCell(1,1); t.deleteRows(); t.undo(); },
				html: '<table><tbody><tr><td>1,1</td><td>1,2</td><td rowspan="3">1,3</td></tr><tr><td>2,1</td><td>2,2</td></tr><tr><td>3,1</td><td>3,2</td></tr></tbody></table>',
			},
			{
				note: '切换表头',
				init: t => { t.reset(4,4); t.selectRange(1,4,2,4); t.merge(); t.toHeaderRows(); t.selectRange(4,1,4,2); t.merge(); t.toHeaderCols(); },
				html: '<table><tbody><tr><th>1,1</th><th>1,2</th><th>1,3</th><th rowspan="2">1,4</th></tr><tr><th>2,1</th><th>2,2</th><th>2,3</th></tr><tr><th>3,1</th><th>3,2</th><td>3,3</td><td>3,4</td></tr><tr><th colspan="2">4,1</th><td>4,3</td><td>4,4</td></tr></tbody></table>',
			},
		];
	}

	run() {
		this.cases.forEach((t, index) => {
			const table = new Table();
			table._fixLineHeight = false;
			table._resetWithCoords = true;
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
			const html = table.getContent();
			if(html != t.html) {
				console.table({note: `测试错误：${t.note ?? ''}`, init: t.init.toString(), want: t.html, got: html});
				throw new Error(`测试错误: @${index}`);
			}
		});
	}
}

try {
	const tt = new TableTest();
	tt.run();
} catch(e) {
	console.error(e);
}
