export class ResizeWatcher {
    dispose() {
      this.target_.removeEventListener("resize", this.onResize_);
    }
  
    constructor(target = window, delay = 0) {
      /** @type Window & typeof globalThis */
      this.target_ = target;
      this.onResize_ = this.onResize_.bind(this);
      this.target_.addEventListener("resize", this.onResize_);
      this.resizeThreshold_ = 10;
      this.callbacks_ = [];
      this.isWatching_ = false;
      this.checkThreshold_ = 200;
      this.delay_ = delay;
    }
  
    register(callback) {
      callback && this.callbacks_.push(callback);
      if (!this.isWatching_) {
        this.isWatching_ = true;
        this.lastCheckTime_ = 0;
        this.lastW_ = this.target_.innerWidth;
        this.lastH_ = this.target_.innerHeight;
      }
    }
  
    unregister(callback) {
      if (!callback) {
        return;
      }
      const idx = this.callbacks_.findIndex((c) => c === callback);
      if (idx < 0) {
        return;
      }
      this.callbacks_.splice(idx, 1);
      if (this.callbacks_.length === 0) {
        this.isWatching_ = false;
      }
    }
  
    onResize_(/** @type UIEvent */ ev) {
      if (!this.isWatching_) {
        return;
      }
      const now = Date.now();
      if (now - this.lastCheckTime_ < this.checkThreshold_) {
        return;
      }
      this.lastCheckTime_ = now;
      const raise = () => {
        const w = this.target_.innerWidth;
        const h = this.target_.innerHeight;
  
        if (
          Math.abs(this.lastW_ - w) < this.resizeThreshold_ &&
          Math.abs(this.lastH_ - h) < this.resizeThreshold_
        ) {
          return;
        }
        this.lastW_ = w;
        this.lastH_ = h;
        for (const callback of this.callbacks_) {
          callback(w, h);
        }
      };
      if (!this.delay_) {
        raise();
      } else {
        setTimeout(() => {
          raise();
        }, this.delay_);
      }
    }
  }