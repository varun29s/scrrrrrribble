class Whiteboard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    
    // Default drawing settings
    this.tool = "brush"; // "brush", "eraser", "fill"
    this.color = "#000000";
    this.size = 4;
    this.isDrawing = false;
    this.isInteractive = false; // Enabled only when player is the drawer
    
    // Coordinates tracker
    this.lastX = 0;
    this.lastY = 0;
    
    // Callback triggers for socket events
    this.onDrawSegment = null; // function({ x0, y0, x1, y1, tool, color, size })
    this.onFill = null; // function({ x, y, color })
    
    this.initEvents();
  }

  setInteractive(value) {
    this.isInteractive = value;
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setSize(size) {
    this.size = size;
  }

  // Get standard coordinates (scaled to internal 800x600 resolution)
  getCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = ((clientX - rect.left) / rect.width) * this.canvas.width;
    const y = ((clientY - rect.top) / rect.height) * this.canvas.height;
    return { x: Math.round(x), y: Math.round(y) };
  }

  initEvents() {
    // Mouse Events
    this.canvas.addEventListener("mousedown", (e) => this.startDraw(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    window.addEventListener("mouseup", () => this.stopDraw());

    // Touch Events for Mobile support
    this.canvas.addEventListener("touchstart", (e) => {
      if (this.isInteractive) e.preventDefault();
      this.startDraw(e);
    }, { passive: false });

    this.canvas.addEventListener("touchmove", (e) => {
      if (this.isInteractive) e.preventDefault();
      this.draw(e);
    }, { passive: false });

    this.canvas.addEventListener("touchend", (e) => {
      if (this.isInteractive) e.preventDefault();
      this.stopDraw();
    }, { passive: false });
  }

  startDraw(e) {
    if (!this.isInteractive) return;
    this.isDrawing = true;
    
    const { x, y } = this.getCoords(e);
    this.lastX = x;
    this.lastY = y;

    if (this.tool === "fill") {
      this.executeFill(x, y, this.color);
      if (this.onFill) {
        this.onFill({ x, y, color: this.color });
      }
      this.isDrawing = false;
    } else {
      // Draw a single dot immediately on click/tap
      this.drawSegment(x, y, x, y, this.tool, this.color, this.size);
      if (this.onDrawSegment) {
        this.onDrawSegment({
          x0: x,
          y0: y,
          x1: x,
          y1: y,
          tool: this.tool,
          color: this.color,
          size: this.size
        });
      }
    }
  }

  draw(e) {
    if (!this.isDrawing || !this.isInteractive) return;
    
    const { x, y } = this.getCoords(e);
    
    this.drawSegment(this.lastX, this.lastY, x, y, this.tool, this.color, this.size);
    
    if (this.onDrawSegment) {
      this.onDrawSegment({
        x0: this.lastX,
        y0: this.lastY,
        x1: x,
        y1: y,
        tool: this.tool,
        color: this.color,
        size: this.size
      });
    }

    this.lastX = x;
    this.lastY = y;
  }

  stopDraw() {
    this.isDrawing = false;
  }

  // Draw segment on Canvas
  drawSegment(x0, y0, x1, y1, tool, color, size) {
    this.ctx.beginPath();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    if (tool === "eraser") {
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = size * 2.5; // Eraser is slightly wider for utility
    } else {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = size;
    }

    this.ctx.moveTo(x0, y0);
    this.ctx.lineTo(x1, y1);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  clear() {
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Flood fill algorithm
  executeFill(startX, startY, fillColor) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const imgData = this.ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const fillRgb = this.hexToRgb(fillColor);
    if (!fillRgb) return;

    const startIdx = (startY * width + startX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    // If target pixel is already the desired color, skip to prevent infinite loops
    if (
      startR === fillRgb.r &&
      startG === fillRgb.g &&
      startB === fillRgb.b &&
      startA === fillRgb.a
    ) {
      return;
    }

    const queue = [[startX, startY]];
    const matchColor = (idx) => {
      return (
        data[idx] === startR &&
        data[idx + 1] === startG &&
        data[idx + 2] === startB &&
        data[idx + 3] === startA
      );
    };

    const colorPixel = (idx) => {
      data[idx] = fillRgb.r;
      data[idx + 1] = fillRgb.g;
      data[idx + 2] = fillRgb.b;
      data[idx + 3] = fillRgb.a;
    };

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      let idx = (y * width + x) * 4;

      if (!matchColor(idx)) continue;

      let leftX = x;
      let leftIdx = idx;
      while (leftX > 0 && matchColor(leftIdx - 4)) {
        leftX--;
        leftIdx -= 4;
      }

      let rightX = x;
      let rightIdx = idx;
      while (rightX < width - 1 && matchColor(rightIdx + 4)) {
        rightX++;
        rightIdx += 4;
      }

      let checkAbove = true;
      let checkBelow = true;

      for (let curX = leftX; curX <= rightX; curX++) {
        let curIdx = (y * width + curX) * 4;
        colorPixel(curIdx);

        if (y > 0) {
          let aboveIdx = ((y - 1) * width + curX) * 4;
          if (matchColor(aboveIdx)) {
            if (checkAbove) {
              queue.push([curX, y - 1]);
              checkAbove = false;
            }
          } else {
            checkAbove = true;
          }
        }

        if (y < height - 1) {
          let belowIdx = ((y + 1) * width + curX) * 4;
          if (matchColor(belowIdx)) {
            if (checkBelow) {
              queue.push([curX, y + 1]);
              checkBelow = false;
            }
          } else {
            checkBelow = true;
          }
        }
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
          a: 255
        }
      : null;
  }

  // Load and apply drawing actions history (e.g. on lobby join or undo)
  loadHistory(history) {
    this.clear();
    history.forEach((action) => {
      if (action.type === "draw") {
        const { x0, y0, x1, y1, tool, color, size } = action.data;
        this.drawSegment(x0, y0, x1, y1, tool, color, size);
      } else if (action.type === "fill") {
        const { x, y, color } = action.data;
        this.executeFill(x, y, color);
      }
    });
  }
}
