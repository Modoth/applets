import { ResizeWatcher } from '../commons/resize-watcher.js'

class SweepMine {
  constructor() { }
  async initComponents() {
    [
      "cellsTable",
      "panel",
      "btnNormal",
      "btnHard",
      "btnVeryHard",
    ].forEach((n) => {
      this[n] = document.getElementById(n);
    });

    const highlightClass = "current-level";
    const handlers = [
      [this.btnNormal, 0.2],
      [this.btnHard, 0.25],
      [this.btnVeryHard, 0.3],
    ].map(([btn, op], i) => [
      async () => {
        this.currentButton?.classList.remove(highlightClass);
        this.mineOp = op;
        this.currentButton = btn;
        this.currentButton?.classList.add(highlightClass);
        this.start();
        await Api.localStorage.setItem(highlightClass, JSON.stringify(i));
      },
      btn,
    ]);
    handlers.forEach(([handler, btn]) => (btn.onclick = handler));
    let i = 0;
    try {
      i = JSON.parse(await Api.localStorage.getItem(highlightClass));
    } catch {
      //
    }
    i = Math.max(0, i)
    handlers[i][0]();
    new ResizeWatcher(window, 50).register(this.tryResize.bind(this));
  }

  updateMines(success) {
    this.cells.forEach((cs) =>
      cs.forEach((c) => {
        if (c.isMine) {
          c.btn.value = success ? "⚑" : "☣";
          c.btn.classList.add(success ? "success" : "fail");
        }
      })
    );
  }

  select(cell) {
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.hasFliped = true;
    if (cell.isFliped) {
      return;
    }
    if (cell.isMine) {
      this.isRunning = false;
      this.updateMines(false);
      return;
    }

    this.flipCell(cell);
    if (this.remainCells <= this.mineCount) {
      this.isRunning = false;
      this.hasFliped = false;
      this.updateMines(true);
    }
  }

  flipCell(cell) {
    if (cell.isFliped) {
      return;
    }
    console.log(this.remainCells);
    this.remainCells--;
    console.log(this.remainCells);
    cell.isFliped = true;
    cell.btn.classList.add("flipped");
    const { i, j } = cell;
    let mineCount = 0;
    const nCells = [];
    const iMin = Math.max(0, i - 1);
    const iMax = Math.min(this.width, i + 2);
    const jMin = Math.max(0, j - 1);
    const jMax = Math.min(this.height, j + 2);
    for (let s = jMin; s < jMax; s++) {
      for (let r = iMin; r < iMax; r++) {
        if (r === i && s === j) {
          continue;
        }
        const nCell = this.cells[s][r];
        if (nCell.isMine) {
          mineCount++;
        } else {
          nCells.push(nCell);
        }
      }
    }
    if (mineCount == 0) {
      for (const c of nCells) {
        this.flipCell(c);
      }
    } else {
      cell.btn.value = mineCount;
    }
  }

  calculateSize() {
    const cellWidth = 36;
    let panel = this.panel;
    this.width = Math.floor(panel.clientWidth / cellWidth);
    this.height = Math.floor(panel.clientHeight / cellWidth);
    // if (this.width < this.height) {
    //   this.height = Math.min(Math.floor(this.width / 0.618), this.height)
    // } else {
    //   this.width = Math.min(Math.floor(this.height / 0.618), this.width)
    // }
    this.cellsTable.style.width = `${this.width * cellWidth}px`;
    this.cellsTable.style.height = `${this.height * cellWidth}px`;
  }

  tryResize() {
    if (this.hasFliped) {
      return;
    }
    this.start();
  }

  start() {
    this.calculateSize();
    this.isRunning = true;
    this.cellsTable.innerHTML = "";
    this.cellsCount = this.width * this.height;
    this.remainCells = this.cellsCount;
    this.cells = [];
    this.mineCount = 0;
    const allCells = [];
    for (let j = 0; j < this.height; j++) {
      const raw = [];
      this.cells.push(raw);
      const cellsRow = document.createElement("div");
      cellsRow.classList.add("cellsRow");
      this.cellsTable.appendChild(cellsRow);
      for (let i = 0; i < this.width; i++) {
        const cell = {
          i,
          j,
        };
        raw.push(cell);
        const btn = document.createElement("input");
        btn.type = "button";
        btn.dataset.char = Math.floor(Math.random() * 9);
        cell.token = Math.random();
        allCells.push([cell, btn]);
        btn.onclick = () => this.select(cell);
        cell.btn = btn;
        cellsRow.appendChild(btn);
      }
    }

    const mineCells = allCells
      .sort((i, j) => i[0].token - j[0].token)
      .slice(0, allCells.length * this.mineOp);
    this.mineCount = mineCells.length;
    for (let [cell, btn] of mineCells) {
      cell.isMine = true;
      btn.classList.add("mine");
    }
  }
}

window.addEventListener("load", () => {
  new SweepMine().initComponents();
});

class App { }
