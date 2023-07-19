export class Polygon {
  vertices: Vector[] = [];
  constructor(vertices: { x: number; y: number }[]) {
    vertices.forEach((v) => this.vertices.push(new Vector(v.x, v.y)));
  }
}

export class Vector {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  subtract(v: Vector) {
    return new Vector(this.x - v.x, this.y - v.y);
  }
  dot(v: Vector) {
    return this.x * v.x + this.y * v.y;
  }
  normal() {
    return new Vector(-this.y, this.x);
  }
  clone() {
    return new Vector(this.x, this.y);
  }
}

export type Projection = {
  min: number;
  max: number;
};

function getAxes(polygon: Polygon): Vector[] {
  const v = polygon.vertices;
  const axes: Vector[] = [];
  for (let i = 0; i < v.length; i++) {
    const p1 = v[i];
    const p2 = v[i + 1 === v.length ? 0 : i + 1];
    const edge = p1.clone().subtract(p2);
    axes.push(edge.normal());
  }
  return axes;
}

function project(polygon: Polygon, axis: Vector): Projection {
  const scalars: number[] = [];
  const v = polygon.vertices;
  for (let i = 0; i < v.length; i++) {
    scalars.push(v[i].dot(axis));
  }
  return {
    min: Math.min(...scalars),
    max: Math.max(...scalars),
  };
}

function areOverlapped(projection1: Projection, projection2: Projection): boolean {
  return projection1.max >= projection2.min && projection2.max >= projection1.min;
}

export function sat(polygon1: Polygon, polygon2: Polygon): boolean {
  const axes = getAxes(polygon1).concat(getAxes(polygon2));
  return axes.every((axis) => {
    const projection1 = project(polygon1, axis);
    const projection2 = project(polygon2, axis);
    return areOverlapped(projection1, projection2);
  });
}
