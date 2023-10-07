export class MoneyManager {
  private money = 0;

  constructor(money: number = 0) {
    this.money = money;
  }

  getMoney(): number {
    return this.money;
  }

  addMoney(money: number): void {
    this.money += money;
  }

  toStringMoney(): string {
    // 3桁ごとにカンマを入れる
    return this.money.toLocaleString();
  }
}
