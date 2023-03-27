import { Api } from '../commons/api.js'

import { ResizeWatcher } from '../commons/resize-watcher.js'

import { astarG, astar } from '../commons/thirds/javascript-astar.js'

// import { sleep } from '../commons/sleep.js'

const CELL_TYPES = ["Empty", "Wall", "Worker"];

const CELL_DTYPES = ["None"];

const BOX_START_ID = 5;

class App {
  constructor() {
    /** @type { Object.<string,HTMLElement> } */
    this.components; //txbLevel
    registerProperties(
      this,
      "workers",
      "boxes",
      "currentLevel",
      "cells",
      "cellWidth",
      "success",
      "steps",
      "showingLevels",
      "levels",
      "autoRunning"
    );
  }

  async start() {
    /** @type { { toast:(msg:string, timeout:number = 1000)=>Promise<any> } } */
    this.modal_ = this.components.modal.model;
    this.localStorage = Api.localStorage;
    this.levels = this.data.levels.map((l, id) => ({ ...l, id: id + 1 }));
    this.currentLevel = 1;
    this.showingLevels = false;
    try {
      this.currentLevel =
        JSON.parse(await this.localStorage.getItem("currentLevel")) || 1;
    } catch {
      //
    }
    await this.loadLevel();
    new ResizeWatcher(window, 50).register(this.tryResize.bind(this));
    window.addEventListener("keydown", this.onKeyDown.bind(this));
  }

  toggleShowLevels() {
    this.showingLevels = !this.showingLevels;
  }

  async selectLevel() {
    const level = 1 * this.components.txbLevel.value;
    this.showingLevels = false;
    if (isNaN(level) || level <= 0 || level > this.levels.length) {
      return;
    }
    this.currentLevel = level;
    await this.localStorage.setItem(
      "currentLevel",
      JSON.stringify(this.currentLevel)
    );
    this.loadLevel();
  }

  async loadLevel() {
    if (this.currentLevel > this.levels.length) {
      await this.modal_.toast("重新开始");
      this.currentLevel = 1;
      await this.localStorage.setItem(
        "currentLevel",
        JSON.stringify(this.currentLevel)
      );
    }
    this.success = false;
    this.steps = 0;
    this.modal_.toast(`关卡 ${this.currentLevel}`);
    this.workers = [];
    this.boxes = new Set();
    const levelData = this.levels[this.currentLevel - 1];
    const dcells = levelData.dcells.split("\n").map((line) =>
      Array.from(line, (c) => {
        return CELL_DTYPES[c] !== undefined
          ? CELL_DTYPES[c]
          : `Box-${c - BOX_START_ID}`;
      })
    );
    this.cells = levelData.cells.split("\n").map((line, y) =>
      Array.from(line, (c, x) => {
        let cell = { x, y, type: CELL_TYPES[c], dtype: dcells[y][x] };
        if (CELL_TYPES[c] === "Worker") {
          this.workers.push({ x, y });
        }
        if (CELL_TYPES[c] === undefined) {
          let id = c - BOX_START_ID;
          let boxCell = { x, y, id };
          cell.type = `Box-${id}`;
          this.boxes.add(boxCell);
          if (cell.dtype === cell.type) {
            boxCell.right = true;
          }
        }
        return cell;
      })
    );
    this.undos = [];
    this.redos = [];
    this.width = this.cells[0].length;
    this.height = this.cells.length;
    this.tryResize();
  }

  async getCommands(worker, target) {
    const cells = this.cells.map((column) =>
      column.map((c) => (c.type === "Empty" || c.type === "Worker" ? 1 : 0))
    );
    const graph = new astarG(cells);
    const start = graph.grid[worker.y][worker.x];
    const end = graph.grid[target.y][target.x];
    const result = astar.search(graph, start, end);
    const commands = [];
    let current = start;
    for (let i = 0; i < result.length; i++) {
      commands.push({
        dy: result[i].x - current.x,
        dx: result[i].y - current.y,
      });
      current = result[i];
    }
    return commands;
  }

  async touchCell(cell) {
    if (this.workers.length !== 1 || cell.type !== "Empty") {
      return;
    }
    const worker = this.workers[0];
    const commands = await this.getCommands(worker, cell);
    if (!commands.length) {
      return;
    }
    console.log(commands);
    this.autoRunning = true;
    for (let command of commands) {
      await this.tryMove(command.dx, command.dy, true);
      await sleep(200);
    }
    this.autoRunning = false;
  }

  async undo() {
    if (this.undos.length <= 0) {
      return;
    }
    const mem = this.undos.pop();
    this.redos.push(this.getCurrentMem());
    this.loadMem(this.cloneMem(mem));
  }

  loadMem(mem) {
    this.cells = mem.cells;
    this.boxes = mem.boxes;
    this.steps = mem.steps;
    this.workers = mem.workers;
  }

  getCurrentMem() {
    return {
      cells: this.cells,
      workers: this.workers,
      boxes: this.boxes,
      steps: this.steps,
    };
  }

  async redo() {
    if (this.redos.length <= 0) {
      return;
    }
    const mem = this.redos.pop();
    this.undos.push(this.getCurrentMem());
    this.loadMem(this.cloneMem(mem));
  }

  cloneMem({ cells, workers, boxes, steps }) {
    const newCells = cells.map((l) => Array.from(l, (c) => ({ ...c })));
    return {
      cells: newCells,
      workers: workers.map((w) => ({ ...w })),
      boxes: new Set(Array.from(boxes, (c) => newCells[c.y][c.x])),
      steps: steps,
    };
  }

  async onKeyDown($event) {
    switch ($event.code) {
      case "ArrowLeft":
        return await this.tryMove(-1, 0);
      case "ArrowUp":
        return await this.tryMove(0, -1);
      case "ArrowRight":
        return await this.tryMove(1, 0);
      case "ArrowDown":
        return await this.tryMove(0, 1);
      default:
        return;
    }
  }

  async restart() {
    await this.loadLevel();
  }

  async close() {
    await Api.appService.close();
  }
  async tryMove(dx, dy, autoRunning) {
    if (this.autoRunning && !autoRunning) {
      return;
    }
    if (this.success) {
      await this.loadLevel(this.currentLevel + 1);
      return;
    }
    let moved = false;
    this.workers = this.workers.sort(
      (i, j) => -(i.x - j.x) * dx - (i.y - j.y) * dy
    );
    const mem = this.getCurrentMem();
    let { cells, workers, boxes, steps } = this.cloneMem(mem);
    for (let i = 0; i < this.workers.length; i++) {
      let { x, y } = this.workers[i];
      let cell = cells[y][x];
      let nx = x + dx;
      let ny = y + dy;
      let ncell = cells[ny]?.[nx];
      switch (ncell?.type) {
        case "Empty":
          ncell.type = cell.type;
          cell.type = "Empty";
          workers[i] = ncell;
          moved = true;
          continue;
        case "Box-0":
        case "Box-1":
        case "Box-2":
        case "Box-3":
        case "Box-4":
          let nnx = nx + dx;
          let nny = ny + dy;
          let nncell = cells[nny]?.[nnx];
          if (nncell?.type !== "Empty") {
            continue;
          }
          nncell.type = ncell.type;
          ncell.type = cell.type;
          cell.type = "Empty";
          workers[i] = ncell;
          boxes.delete(ncell);
          ncell.right = undefined;
          boxes.add(nncell);
          nncell.right = nncell.dtype === nncell.type ? true : undefined;
          moved = true;
        default:
          continue;
      }
    }
    if (!moved) {
      return;
    }
    this.undos.push(mem);
    this.redos = [];
    this.cells = cells;
    this.boxes = boxes;
    this.workers = workers;
    this.steps = this.steps + 1;
    for (let box of this.boxes) {
      if (!box.right) {
        return;
      }
    }
    this.success = true;
    this.modal_.toast("完成");
    this.currentLevel = this.currentLevel + 1;
    await this.localStorage.setItem(
      "currentLevel",
      JSON.stringify(this.currentLevel)
    );
  }

  tryResize() {
    this.cellWidth = Math.min(
      Math.floor(window.innerWidth / this.width),
      Math.floor(window.innerHeight / this.height)
    );
  }
}