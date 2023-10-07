export const defaultGlobalTimeSpeed = 5; // 1サイクルで進む秒数

export class GlobalTimeManager {
  private _globalTimeSpeed = defaultGlobalTimeSpeed;
  private _globalTime = 0;

  get globalTimeSpeed(): number {
    return this._globalTimeSpeed;
  }
  get globalTime(): number {
    return this._globalTime;
  }
  private set globalTime(time: number) {
    this._globalTime = time;
  }

  constructor() {
    this.resetGlobalTime();
  }

  resetGlobalTime(time: number = 7 * 60 * 60) {
    this.globalTime = time;
  }

  toStringGlobalTime(): string {
    const m = Math.floor((this.globalTime / 60) % 60);
    return Math.floor(this.globalTime / 60 / 60).toString() + ':' + (m < 10 ? '0' + m.toString() : '' + m.toString());
  }

  tick(): void {
    this.globalTime += this.globalTimeSpeed;

    // 24時間を超えたら0に戻すほうがいいかも
    if (this.globalTime >= 24 * 60 * 60) {
      this.globalTime = 24 * 60 * 60 - 1;
    }
  }
}
