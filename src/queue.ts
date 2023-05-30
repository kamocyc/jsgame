export class Queue<T> {
  private capacity: number;
  private items: T[];
  private frontIndex: number;
  private rearIndex: number;
  private size: number;

  constructor(capacity = 10) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    this.frontIndex = 0;
    this.rearIndex = 0;
    this.size = 0;
  }

  enqueue(element: T): void {
    if (this.size === this.capacity) {
      this.expandCapacity();
    }
    this.items[this.rearIndex] = element;
    this.rearIndex = (this.rearIndex + 1) % this.capacity;
    this.size++;
  }

  dequeue(): T {
    if (this.isEmpty()) {
      throw new Error('Queue is empty');
    }
    const removedElement = this.items[this.frontIndex];
    this.items[this.frontIndex] = undefined as T;
    this.frontIndex = (this.frontIndex + 1) % this.capacity;
    this.size--;
    return removedElement;
  }

  front(): T {
    if (this.isEmpty()) {
      throw new Error('Queue is empty');
    }
    return this.items[this.frontIndex];
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  getSize(): number {
    return this.size;
  }

  print() {
    let result = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.frontIndex + i) % this.capacity;
      result.push(this.items[index]);
    }
    console.log(result.toString());
  }

  private expandCapacity(): void {
    const newCapacity = this.capacity * 2;
    const newItems = new Array(newCapacity);

    for (let i = 0; i < this.size; i++) {
      const index = (this.frontIndex + i) % this.capacity;
      newItems[i] = this.items[index];
    }

    this.items = newItems;
    this.frontIndex = 0;
    this.rearIndex = this.size;
    this.capacity = newCapacity;
  }
}

// // Test Case 1: Basic operations
// const queue = new Queue();
// queue.enqueue(10);
// queue.enqueue(20);
// queue.enqueue(30);
// queue.print(); // Output: 10,20,30
// console.log(queue.front()); // Output: 10
// console.log(queue.dequeue()); // Output: 10
// console.log(queue.getSize()); // Output: 2
// console.log(queue.isEmpty()); // Output: false

// // Test Case 2: Enqueue beyond initial capacity
// const queue2 = new Queue(3);
// queue2.enqueue(10);
// queue2.enqueue(20);
// queue2.enqueue(30);
// queue2.enqueue(40);
// queue2.print(); // Output: 10,20,30,40
// console.log(queue2.getSize()); // Output: 4

// // Test Case 3: Dequeue empty queue
// const queue3 = new Queue();
// console.log(queue3.dequeue()); // Output: Queue is empty

// // Test Case 4: Mixed enqueue and dequeue operations
// const queue4 = new Queue(3);
// queue4.enqueue(10);
// queue4.dequeue();
// queue4.enqueue(20);
// queue4.enqueue(30);
// queue4.enqueue(40);
// console.log(queue4.front()); // Output: 20
// console.log(queue4.dequeue()); // Output: 20
// queue4.enqueue(50);
// queue4.print(); // Output: 30,40,50
// console.log(queue4.getSize()); // Output: 3

// // Test Case 5: Empty queue
// const queue5 = new Queue();
// console.log(queue5.isEmpty()); // Output: true
// console.log(queue5.getSize()); // Output: 0
// console.log(queue5.front()); // Output: Queue is empty
// console.log(queue5.dequeue()); // Output: Queue is empty
// queue5.print(); // Output: (nothing)
