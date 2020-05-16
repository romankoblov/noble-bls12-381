// Group
// Fp: (x, y)
// Fp2: (x1, x2), (y1, y2)
// Fp12

export const CURVE = {
  // a characteristic
  P: 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaabn,
  // an order
  r: 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n,
  // a cofactor
  h: 0x396c8c005555e1568c00aaab0000aaabn,
  Gx: 0x17f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bbn,
  Gy: 0x8b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e18b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1n,

  // G2
  // G^2 - 1
  P2: 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaabn ** 2n - 1n,
  h2: 0x5d543a95414e7f1091d50792876a202cd91de4547085abaa68a205b2e5a7ddfa628f1cb4d9e82ef21537e293a6691ae1616ec6e786f0c70cf1c38e31c7238e5n,
  G2x: [
    0x24aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8n,
    0x13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7en,
  ],
  G2y: [
    0xce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801n,
    0x606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79ben,
  ],
};

type Bytes = Uint8Array | string;
type Hash = Bytes;
type PrivateKey = Bytes | bigint | number;
type Domain = PrivateKey;
type PublicKey = Bytes;
type Signature = Bytes;
type BigintTuple = [bigint, bigint];
// prettier-ignore
export type BigintTwelve = [
  bigint, bigint, bigint, bigint,
  bigint, bigint, bigint, bigint,
  bigint, bigint, bigint, bigint
];
type Fp12Like = Fp12 | BigintTwelve;
type FpTwelve = [Fp, Fp, Fp, Fp, Fp, Fp, Fp, Fp, Fp, Fp, Fp, Fp];

type ReturnType<T extends Function> = T extends (...args: any[]) => infer R ? R : any;
type IncludedTypes<Base, Type> = {
  [Key in keyof Base]: Base[Key] extends Type ? Key : never;
};
type AllowedNames<Base, Type> = keyof IncludedTypes<Base, Type>;

// Finite field
interface Field<T> {
  readonly one: Field<T>;
  readonly zero: Field<T>;
  readonly value: T;
  normalize(v: Field<T> | T | bigint): bigint | Field<T>;
  isEmpty(): boolean;
  equals(otherValue: Field<T> | T): boolean;
  add(otherValue: Field<T> | T): Field<T>;
  multiply(otherValue: Field<T> | T | bigint): Field<T>;
  div(otherValue: Field<T> | T | bigint): Field<T>;
  square(): Field<T>;
  subtract(otherValue: Field<T> | T): Field<T>;
  negative(): Field<T>;
  invert(): Field<T>;
  pow(n: bigint): Field<T>;
}

function normalized<T, G extends Field<T>, M extends AllowedNames<G, Function>>(
  target: G,
  propertyKey: M,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  type GroupMethod = G[M] & Function;
  const propertyValue: G[M] | GroupMethod = target[propertyKey];
  if (typeof propertyValue !== 'function') {
    return descriptor;
  }
  const previousImplementation: GroupMethod = propertyValue;
  descriptor.value = function (arg: G | T | bigint): ReturnType<GroupMethod> {
    const modifiedArgument = target.normalize(arg);
    return previousImplementation.call(this, modifiedArgument);
  };
  return descriptor;
}

// Finite field over P.
export class Fp implements Field<bigint> {
  static ORDER = CURVE.P;
  private _value: bigint = 0n;

  public get value() {
    return this._value;
  }

  public get zero() {
    return new Fp(0n);
  }
  public get one() {
    return new Fp(1n);
  }

  constructor(value: bigint = 0n) {
    this._value = this.mod(value, Fp.ORDER);
  }

  private mod(a: bigint, b: bigint) {
    const result = a % b;
    return result >= 0n ? result : b + result;
  }

  normalize(v: Fp | bigint): Fp {
    return v instanceof Fp ? v : new Fp(v);
  }

  isEmpty() {
    return this._value === 0n;
  }

  @normalized equals(other: Fp) {
    return this._value === other._value;
  }

  negative() {
    return new Fp(-this._value);
  }

  invert() {
    return new Fp(invert(this._value, Fp.ORDER));
  }

  @normalized add(other: Fp | bigint) {
    return new Fp((other as Fp)._value + this._value);
  }

  square() {
    return new Fp(this._value * this._value);
  }

  pow(n: bigint) {
    return new Fp(powMod(this._value, n, Fp.ORDER));
  }

  @normalized subtract(other: Fp | bigint) {
    return new Fp(this._value - (other as Fp)._value);
  }

  @normalized multiply(other: Fp | bigint) {
    return new Fp((other as Fp)._value * this._value);
  }

  @normalized div(other: Fp | bigint) {
    return this.multiply((other as Fp).invert());
  }
}

// Finite extension field over irreducible degree-1 polynominal.
// Fq(u)/(u2 − β) where β = −1
export class Fp2 implements Field<BigintTuple> {
  private static ORDER = CURVE.P2;
  private static DIV_ORDER = (Fp2.ORDER + 8n) / 16n;
  private static EIGHTH_ROOTS_OF_UNITY = Array(8)
  .fill(null)
  .map((_, i) => new Fp2(1n, 1n).pow(BigInt(i) * Fp2.ORDER / 8n));
  public static COFACTOR = CURVE.h2;

  private coeficient1 = new Fp(0n);
  private coeficient2 = new Fp(0n);

  public get value(): BigintTuple {
    return [this.coeficient1.value, this.coeficient2.value];
  }

  public get zero() {
    return new Fp2(0n, 0n);
  }

  public get one() {
    return new Fp2(1n, 0n);
  }

  constructor(coef1: Fp | bigint = 0n, coef2: Fp | bigint = 0n) {
    this.coeficient1 = coef1 instanceof Fp ? coef1 : new Fp(coef1);
    this.coeficient2 = coef2 instanceof Fp ? coef2 : new Fp(coef2);
  }

  normalize(v: Fp2 | BigintTuple | bigint): bigint | Fp2 {
    if (typeof v === 'bigint') {
      return v;
    }
    return v instanceof Fp2 ? v : new Fp2(...v);
  }

  isEmpty() {
    return this.coeficient1.isEmpty() && this.coeficient2.isEmpty();
  }

  @normalized
  equals(rhs: Fp2) {
    return this.coeficient1.equals(rhs.coeficient1) && this.coeficient2.equals(rhs.coeficient2);
  }

  negative() {
    return new Fp2(this.coeficient1.negative(), this.coeficient2.negative());
  }

  @normalized
  add(rhs: Fp2) {
    return new Fp2(this.coeficient1.add(rhs.coeficient1), this.coeficient2.add(rhs.coeficient2));
  }

  @normalized
  subtract(rhs: Fp2) {
    return new Fp2(
      this.coeficient1.subtract(rhs.coeficient1),
      this.coeficient2.subtract(rhs.coeficient2)
    );
  }

  // Karatsuba multiplication:
  // In BLS12-381's Fp2, our beta is -1 so we
  // can modify this formula. (Also, since we always
  // subtract v1, we can compute v1 = -a1 * b1.)
  @normalized
  multiply(otherValue: Fp2 | bigint) {
    if (typeof otherValue === 'bigint') {
      return new Fp2(this.coeficient1.multiply(otherValue), this.coeficient2.multiply(otherValue));
    }
    // v0  = a0 * b0
    const v0 = this.coeficient1.multiply(otherValue.coeficient1);
    // v1  = (-a1) * b1
    const v1 = this.coeficient2.negative().multiply(otherValue.coeficient2);
    // c0 = v0 + v1
    const c0 = v0.add(v1);
    // c1 = (a0 + a1) * (b0 + b1) - v0 + v1
    const c1 = this.coeficient1
      .add(this.coeficient2)
      .multiply(otherValue.coeficient1.add(otherValue.coeficient2))
      .subtract(v0)
      .add(v1);
    return new Fp2(c0, c1);
  }

  // Multiply a + bu by u + 1, getting
  // au + a + bu^2 + bu
  // and because u^2 = -1, we get
  // (a - b) + (a + b)u
  mulByNonresidue() {
    return new Fp2(
      this.coeficient1.subtract(this.coeficient2),
      this.coeficient1.add(this.coeficient2)
    );
  }

  // Complex squaring:
  //
  // v0  = c0 * c1
  // c0' = (c0 + c1) * (c0 + β*c1) - v0 - β * v0
  // c1' = 2 * v0
  //
  // In BLS12-381's Fp2, our β is -1 so we
  // can modify this formula:
  //
  // c0' = (c0 + c1) * (c0 - c1)
  // c1' = 2 * c0 * c1
  square() {
    const a = this.coeficient1.add(this.coeficient2);
    const b = this.coeficient1.subtract(this.coeficient2);
    const c = this.coeficient1.add(this.coeficient1);
    return new Fp2(a.multiply(b), c.multiply(this.coeficient2));
  }

  sqrt() {
    const candidateSqrt = this.pow(Fp2.DIV_ORDER);
    const check = candidateSqrt.square().div(this);
    const rootIndex = Fp2.EIGHTH_ROOTS_OF_UNITY.findIndex((a) => a.equals(check));
    if (rootIndex === -1 || (rootIndex & 1) === 1) {
      return null;
    }
    const x1 = candidateSqrt.div(Fp2.EIGHTH_ROOTS_OF_UNITY[rootIndex >> 1]);
    const x2 = x1.negative();
    const isImageGreater = x1.coeficient2.value > x2.coeficient2.value;
    const isReconstructedGreater =
      x1.coeficient2.equals(x2.coeficient2) && x1.coeficient1.value > x2.coeficient1.value;
    return isImageGreater || isReconstructedGreater ? x1 : x2;
  }

  pow(n: bigint) {
    if (n === 1n) {
      return this;
    }
    let result = new Fp2(1n, 0n);
    let value: Fp2 = this;
    while (n > 0n) {
      if ((n & 1n) === 1n) {
        result = result.multiply(value);
      }
      n >>= 1n;
      value = value.square();
    }
    return result;
  }

  // We wish to find the multiplicative inverse of a nonzero
  // element a + bu in Fp2. We leverage an identity
  //
  // (a + bu)(a - bu) = a^2 + b^2
  //
  // which holds because u^2 = -1. This can be rewritten as
  //
  // (a + bu)(a - bu)/(a^2 + b^2) = 1
  //
  // because a^2 + b^2 = 0 has no nonzero solutions for (a, b).
  // This gives that (a - bu)/(a^2 + b^2) is the inverse
  // of (a + bu). Importantly, this can be computing using
  // only a single inversion in Fp.
  invert() {
    const t = this.coeficient1.square().add(this.coeficient2.square()).invert();
    return new Fp2(this.coeficient1.multiply(t), this.coeficient2.multiply(t.negative()));
  }

  @normalized
  div(otherValue: Fp2 | bigint) {
    if (typeof otherValue === 'bigint') {
      return new Fp2(this.coeficient1.div(otherValue), this.coeficient2.div(otherValue));
    }
    return this.multiply(otherValue.invert());
  }
}

// prettier-ignore
const FP12_DEFAULT: BigintTwelve = [
  0n, 1n, 0n, 1n,
  0n, 1n, 0n, 1n,
  0n, 1n, 0n, 1n
];

// Finite extension field.
/// This represents an element c0 + c1 * w of Fp12 = Fp6 / w^2 - v.
export class Fp12 implements Field<BigintTwelve> {
  private coefficients: FpTwelve = FP12_DEFAULT.map((a) => new Fp(a)) as FpTwelve;
  // prettier-ignore
  private static readonly MODULE_COEFFICIENTS: BigintTwelve = [
    2n, 0n, 0n, 0n, 0n, 0n, -2n, 0n, 0n, 0n, 0n, 0n
  ];
  private static readonly ENTRY_COEFFICIENTS: Array<[number, bigint]> = [
    [0, 2n],
    [6, -2n],
  ];

  public get value() {
    return this.coefficients.map((c) => c.value) as BigintTwelve;
  }

  public get zero() {
    return new Fp12(0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);
  }
  public get one() {
    return new Fp12(1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);
  }

  constructor();
  // prettier-ignore
  constructor(
    c0: Fp, c1: Fp, c2: Fp, c3: Fp,
    c4: Fp, c5: Fp, c6: Fp, c7: Fp,
    c8: Fp, c9: Fp, c10: Fp, c11: Fp
  );
  // prettier-ignore
  constructor(
    c0: bigint, c1: bigint, c2: bigint, c3: bigint,
    c4: bigint, c5: bigint, c6: bigint, c7: bigint,
    c8: bigint, c9: bigint, c10: bigint, c11: bigint
  );
  constructor(...args: [] | BigintTwelve | FpTwelve) {
    args = args.length === 0 ? FP12_DEFAULT : (args.slice(0, 12) as BigintTwelve);
    // @ts-ignore stupid TS
    // prettier-ignore
    this.coefficients = args[0] instanceof Fp ? args : (args.map(a => new Fp(a)) as FpTwelve);
  }

  public normalize(v: Fp12Like | bigint) {
    if (typeof v === 'bigint') {
      return v;
    }
    return v instanceof Fp12 ? v : new Fp12(...v);
  }

  isEmpty() {
    return this.coefficients.every((a) => a.isEmpty());
  }

  @normalized
  equals(rhs: Fp12Like) {
    return this.coefficients.every((a, i) => a.equals((rhs as Fp12).coefficients[i]));
  }

  negative() {
    return new Fp12(...(this.coefficients.map((a) => a.negative()) as FpTwelve));
  }

  @normalized
  add(rhs: Fp12Like) {
    return new Fp12(
      ...(this.coefficients.map((a, i) => a.add((rhs as Fp12).coefficients[i])) as FpTwelve)
    );
  }

  @normalized
  subtract(rhs: Fp12Like) {
    return new Fp12(
      ...(this.coefficients.map((a, i) => a.subtract((rhs as Fp12).coefficients[i])) as FpTwelve)
    );
  }

  @normalized
  multiply(otherValue: Fp12Like | bigint) {
    if (typeof otherValue === 'bigint') {
      return new Fp12(...(this.coefficients.map((a) => a.multiply(otherValue)) as FpTwelve));
    }
    const LENGTH = this.coefficients.length;

    const filler = Array(LENGTH * 2 - 1)
      .fill(null)
      .map(() => new Fp());
    for (let i = 0; i < LENGTH; i++) {
      for (let j = 0; j < LENGTH; j++) {
        filler[i + j] = filler[i + j].add(
          this.coefficients[i].multiply((otherValue as Fp12).coefficients[j])
        );
      }
    }
    for (let exp = LENGTH - 2; exp >= 0; exp--) {
      const top = filler.pop();
      if (top === undefined) {
        break;
      }
      for (const [i, value] of Fp12.ENTRY_COEFFICIENTS) {
        filler[exp + i] = filler[exp + i].subtract(top.multiply(value));
      }
    }
    return new Fp12(...(filler as FpTwelve));
  }

  square() {
    return this.multiply(this);
  }

  pow(n: bigint) {
    if (n === 1n) {
      return this;
    }
    let result = new Fp12(1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);
    let value: Fp12 = this;
    while (n > 0n) {
      if ((n & 1n) === 1n) {
        result = result.multiply(value);
      }
      n >>= 1n;
      value = value.square();
    }
    return result;
  }

  private degree(nums: bigint[]) {
    let degree = nums.length - 1;
    while (nums[degree] === 0n && degree !== 0) {
      degree--;
    }
    return degree;
  }

  private primeNumberInvariant(num: bigint) {
    return new Fp(num).invert().value;
  }

  private optimizedRoundedDiv(coefficients: bigint[], others: bigint[]) {
    const tmp = [...coefficients];
    const degreeThis = this.degree(tmp);
    const degreeOthers = this.degree(others);
    const zeros = Array.from(tmp).fill(0n);
    const edgeInvariant = this.primeNumberInvariant(others[degreeOthers]);
    for (let i = degreeThis - degreeOthers; i >= 0; i--) {
      zeros[i] = zeros[i] + tmp[degreeOthers + i] * edgeInvariant;
      for (let c = 0; c < degreeOthers; c++) {
        tmp[c + i] = tmp[c + i] - zeros[c];
      }
    }
    return new Fp12(...(zeros.slice(0, this.degree(zeros) + 1) as BigintTwelve));
  }

  invert(): Fp12 {
    const LENGTH = this.coefficients.length;
    let lm = [...this.one.coefficients.map((a) => a.value), 0n];
    let hm = [...this.zero.coefficients.map((a) => a.value), 0n];
    let low = [...this.coefficients.map((a) => a.value), 0n];
    let high = [...Fp12.MODULE_COEFFICIENTS, 1n];
    while (this.degree(low) !== 0) {
      const { coefficients } = this.optimizedRoundedDiv(high, low);
      const zeros = Array(LENGTH + 1 - coefficients.length)
        .fill(null)
        .map(() => new Fp());
      const roundedDiv = coefficients.concat(zeros);
      let nm = [...hm];
      let nw = [...high];
      for (let i = 0; i <= LENGTH; i++) {
        for (let j = 0; j <= LENGTH - i; j++) {
          nm[i + j] -= lm[i] * roundedDiv[j].value;
          nw[i + j] -= low[i] * roundedDiv[j].value;
        }
      }
      nm = nm.map((a) => new Fp(a).value);
      nw = nw.map((a) => new Fp(a).value);
      hm = lm;
      lm = nm;
      high = low;
      low = nw;
    }
    const result = new Fp12(...(lm as BigintTwelve));
    return result.div(low[0]);
  }

  @normalized
  div(otherValue: Fp12 | bigint) {
    if (typeof otherValue === 'bigint') {
      return new Fp12(...(this.coefficients.map((a) => a.div(otherValue)) as FpTwelve));
    }
    return this.multiply(otherValue.invert());
  }
}

type Constructor<T> = { new (...args: any[]): Field<T> };
type GroupCoordinats<T> = { x: Field<T>; y: Field<T>; z: Field<T> };

export class Point<T> {
  // "Twist" a point in E(Fp2) into a point in E(Fp12)
  public static get W() {
    return new Fp12(0n, 1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);
  }
  public static get W_SQUARE() {
    return new Fp12(0n, 0n, 1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);
  }
  public static get W_CUBE() {
    return new Fp12(0n, 0n, 0n, 1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);
  }

  constructor(
    public x: Field<T>,
    public y: Field<T>,
    public z: Field<T>,
    private C: Constructor<T>
  ) {}

  isEmpty() {
    return this.x.isEmpty() && this.y.isEmpty() && this.z.isEmpty();
  }

  isOnCurve(b: Field<T>) {
    if (this.isEmpty()) {
      return true;
    }
    // Check that a point is on the curve defined by y**2 * z - x**3 == b * z**3
    const lefSide = this.y.square().multiply(this.z).subtract(this.x.pow(3n));
    const rightSide = b.multiply(this.z.pow(3n));
    return lefSide.equals(rightSide);
  }

  equals(other: Point<T>) {
    // x1 * z2 == x2 * z1 and y1 * z2 == y2 * z1
    return (
      this.x.multiply(other.z).equals(other.x.multiply(this.z)) &&
      this.y.multiply(other.z).equals(other.y.multiply(this.z))
    );
  }

  negative() {
    return new Point(this.x, this.y.negative(), this.z, this.C);
  }

  to2D() {
    return [this.x.div(this.z), this.y.div(this.z)];
  }

  double() {
    if (this.isEmpty()) {
      return this;
    }
    // W = 3 * x * x
    const W = this.x.square().multiply(3n);
    // S = y * z
    const S = this.y.multiply(this.z);
    // B = x * y * S
    const B = this.x.multiply(this.y).multiply(S);
    // H = W * W - 8 * B
    const H = W.square().subtract(B.multiply(8n));
    // x = 2 * H * S:
    const newX = H.multiply(S).multiply(2n);
    const tmp = this.y.square().multiply(S.square()).multiply(8n);
    // y = W * (4 * B - H) - 8 * y**2 * s**2
    const newY = W.multiply(B.multiply(4n).subtract(H)).subtract(tmp);
    // z = 8 * S**3
    const newZ = S.pow(3n).multiply(8n);
    return new Point(newX, newY, newZ, this.C);
  }

  add(other: Point<T>) {
    if (other.z.isEmpty()) {
      return this;
    }
    if (this.z.isEmpty()) {
      return other;
    }
    const u1 = other.y.multiply(this.z);
    const u2 = this.y.multiply(other.z);
    const v1 = other.x.multiply(this.z);
    const v2 = this.x.multiply(other.z);
    if (v1.equals(v2) && u1.equals(u2)) {
      return this.double();
    }
    if (v1.equals(v2)) {
      return new Point(this.x.one, this.y.one, this.z.zero, this.C);
    }
    const u = u1.subtract(u2);
    const v = v1.subtract(v2);
    const V_CUBE = v.pow(3n);
    const SQUERED_V_MUL_V2 = v.square().multiply(v2);
    const W = this.z.multiply(other.z);
    // u**2 * W - v**3 - 2 * v**2 * v2
    const A = u.square().multiply(W).subtract(v.pow(3n)).subtract(SQUERED_V_MUL_V2.multiply(2n));
    const newX = v.multiply(A);
    // y = u * (v**2 * v2 - A) - v**3 * u2
    const newY = u.multiply(SQUERED_V_MUL_V2.subtract(A)).subtract(V_CUBE.multiply(u2));
    const newZ = V_CUBE.multiply(W);
    return new Point(newX, newY, newZ, this.C);
  }

  subtract(other: Point<T>) {
    return this.add(other.negative());
  }

  multiply(n: number | bigint) {
    n = BigInt(n);
    let result = new Point(this.x.one, this.y.one, this.z.zero, this.C);
    let point = this as Point<T>;
    while (n > 0n) {
      if ((n & 1n) === 1n) {
        result = result.add(point);
      }
      point = point.double();
      n >>= 1n;
    }
    return result;
  }

  // Field isomorphism from z[p] / x**2 to z[p] / x**2 - 2*x + 2
  twist() {
    // Prevent twisting of non-multidimensional type
    if (!Array.isArray(this.x.value)) {
      return new Point(new Fp12(), new Fp12(), new Fp12(), Fp12);
    }
    // @ts-ignore stupid TS
    const { x, y, z }: GroupCoordinats<BigintTuple | BigintTwelve> = this;
    const [cx1, cx2] = [x.value[0] - x.value[1], x.value[1]];
    const [cy1, cy2] = [y.value[0] - y.value[1], y.value[1]];
    const [cz1, cz2] = [z.value[0] - z.value[1], z.value[1]];
    const newX = new Fp12(cx1, 0n, 0n, 0n, 0n, 0n, cx2, 0n, 0n, 0n, 0n, 0n);
    const newY = new Fp12(cy1, 0n, 0n, 0n, 0n, 0n, cy2, 0n, 0n, 0n, 0n, 0n);
    const newZ = new Fp12(cz1, 0n, 0n, 0n, 0n, 0n, cz2, 0n, 0n, 0n, 0n, 0n);
    return new Point(newX.div(Point.W_SQUARE), newY.div(Point.W_CUBE), newZ, Fp12);
  }
}

// https://eprint.iacr.org/2019/403.pdf
// 2.1 The BLS12-381 elliptic curve
// q =  z**4 − z**2 + 1
// p = z + (z**4 − z**2 + 1) * (z − 1)**2 / 3
function finalExponentiate(p: Field<BigintTwelve>) {
  return p.pow((CURVE.P ** 12n - 1n) / CURVE.r);
}

// Curve is y**2 = x**3 + 4
export const B = new Fp(4n);
// Twisted curve over Fp2
export const B2 = new Fp2(4n, 4n);
// Extension curve over Fp12; same b value as over Fp
export const B12 = new Fp12(4n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n);

const Z1 = new Point(new Fp(1n), new Fp(1n), new Fp(0n), Fp);
const Z2 = new Point(new Fp2(1n, 0n), new Fp2(1n, 0n), new Fp2(0n, 0n), Fp2);

const POW_2_381 = 2n ** 381n;
const POW_2_382 = POW_2_381 * 2n;
const POW_2_383 = POW_2_382 * 2n;
const PUBLIC_KEY_LENGTH = 48;

const sha256 = async (message: Uint8Array): Promise<Uint8Array> => {
  // @ts-ignore
  if (typeof window == 'object' && 'crypto' in window) {
    // @ts-ignore
    const buffer = await window.crypto.subtle.digest('SHA-256', message.buffer);
    // @ts-ignore
    return new Uint8Array(buffer);
    // @ts-ignore
  } else if (typeof process === 'object' && 'node' in process.versions) {
    // @ts-ignore
    const { createHash } = require('crypto');
    const hash = createHash('sha256');
    hash.update(message);
    return Uint8Array.from(hash.digest());
  } else {
    throw new Error("The environment doesn't have sha256 function");
  }
};

function fromHexBE(hex: string) {
  return BigInt(`0x${hex}`);
}

function fromBytesBE(bytes: Bytes) {
  if (typeof bytes === 'string') {
    return fromHexBE(bytes);
  }
  let value = 0n;
  for (let i = bytes.length - 1, j = 0; i >= 0; i--, j++) {
    value += (BigInt(bytes[i]) & 255n) << (8n * BigInt(j));
  }
  return value;
}

function padStart(bytes: Uint8Array, count: number, element: number) {
  if (bytes.length >= count) {
    return bytes;
  }
  const diff = count - bytes.length;
  const elements = Array(diff)
    .fill(element)
    .map((i: number) => i);
  return concatTypedArrays(new Uint8Array(elements), bytes);
}

function toBytesBE(num: bigint | number | string, padding: number = 0) {
  let hex = typeof num === 'string' ? num : num.toString(16);
  hex = hex.length & 1 ? `0${hex}` : hex;
  const len = hex.length / 2;
  const u8 = new Uint8Array(len);
  for (let j = 0, i = 0; i < hex.length && i < len * 2; i += 2, j++) {
    u8[j] = parseInt(hex[i] + hex[i + 1], 16);
  }
  return padStart(u8, padding, 0);
}

function toBigInt(num: string | Uint8Array | bigint | number) {
  if (typeof num === 'string') {
    return fromHexBE(num);
  }
  if (typeof num === 'number') {
    return BigInt(num);
  }
  if (num instanceof Uint8Array) {
    return fromBytesBE(num);
  }
  return num;
}

function hexToArray(hex: string) {
  hex = hex.length & 1 ? `0${hex}` : hex;
  const len = hex.length;
  const result = new Uint8Array(len / 2);
  for (let i = 0, j = 0; i < len - 1; i += 2, j++) {
    result[j] = parseInt(hex[i] + hex[i + 1], 16);
  }
  return result;
}

function concatTypedArrays(...bytes: Bytes[]) {
  return new Uint8Array(
    bytes.reduce((res: number[], bytesView: Bytes) => {
      bytesView = bytesView instanceof Uint8Array ? bytesView : hexToArray(bytesView);
      return [...res, ...bytesView];
    }, [])
  );
}

function mod(a: bigint, b: bigint) {
  const res = a % b;
  return res >= 0n ? res : b + res;
}

function powMod(a: bigint, power: bigint, m: bigint) {
  let res = 1n;
  while (power > 0n) {
    if (power & 1n) {
      res = mod(res * a, m);
    }
    power >>= 1n;
    a = mod(a * a, m);
  }
  return res;
}

// Eucledian GCD
// https://brilliant.org/wiki/extended-euclidean-algorithm/
function egcd(a: bigint, b: bigint) {
  let [x, y, u, v] = [0n, 1n, 1n, 0n];
  while (a !== 0n) {
    let q = b / a;
    let r = b % a;
    let m = x - u * q;
    let n = y - v * q;
    [b, a] = [a, r];
    [x, y] = [u, v];
    [u, v] = [m, n];
  }
  let gcd = b;
  return [gcd, x, y];
}

function invert(number: bigint, modulo: bigint) {
  if (number === 0n || modulo <= 0n) {
    throw new Error('invert: expected positive integers');
  }
  let [gcd, x] = egcd(mod(number, modulo), modulo);
  if (gcd !== 1n) {
    throw new Error('invert: does not exist');
  }
  return mod(x, modulo);
}

async function getXCoordinate(hash: Hash, domain: Bytes) {
  const xReconstructed = toBigInt(await sha256(concatTypedArrays(hash, domain, '01')));
  const xImage = toBigInt(await sha256(concatTypedArrays(hash, domain, '02')));
  return new Fp2(xReconstructed, xImage);
}

const POW_SUM = POW_2_383 + POW_2_382;

function compressG1(point: Point<bigint>) {
  if (point.equals(Z1)) {
    return POW_SUM;
  }
  const [x, y] = point.to2D() as [Fp, Fp];
  const flag = (y.value * 2n) / P;
  return x.value + flag * POW_2_381 + POW_2_383;
}

const PART_OF_P = (CURVE.P + 1n) / 4n;

function decompressG1(compressedValue: bigint) {
  const bflag = (compressedValue % POW_2_383) / POW_2_382;
  if (bflag === 1n) {
    return Z1;
  }
  const x = compressedValue % POW_2_381;
  const fullY = (x ** 3n + B.value) % P;
  let y = powMod(fullY, PART_OF_P, P);
  if (powMod(y, 2n, P) !== fullY) {
    throw new Error('The given point is not on G1: y**2 = x**3 + b');
  }
  const aflag = (compressedValue % POW_2_382) / POW_2_381;
  if ((y * 2n) / P !== aflag) {
    y = P - y;
  }
  return new Point(new Fp(x), new Fp(y), new Fp(1n), Fp);
}

function compressG2(point: Point<[bigint, bigint]>) {
  if (point.equals(Z2)) {
    return [POW_2_383 + POW_2_382, 0n];
  }
  if (!point.isOnCurve(B2)) {
    throw new Error('The given point is not on the twisted curve over FQ**2');
  }
  const [[x0, x1], [y0, y1]] = point.to2D().map((a) => a.value);
  const producer = y1 > 0 ? y1 : y0;
  const aflag1 = (producer * 2n) / P;
  const z1 = x1 + aflag1 * POW_2_381 + POW_2_383;
  const z2 = x0;
  return [z1, z2];
}

function decompressG2([z1, z2]: [bigint, bigint]) {
  const bflag1 = (z1 % POW_2_383) / POW_2_382;
  if (bflag1 === 1n) {
    return Z2;
  }
  const x = new Fp2(z2, z1 % POW_2_381);
  let y = x.pow(3n).add(B2).sqrt();
  if (y === null) {
    throw new Error('Failed to find a modular squareroot');
  }
  const [y0, y1] = y.value;
  const aflag1 = (z1 % POW_2_382) / POW_2_381;
  const isGreaterCoefficient = y1 > 0 && (y1 * 2n) / P !== aflag1;
  const isZeroCoefficient = y1 === 0n && (y0 * 2n) / P !== aflag1;
  if (isGreaterCoefficient || isZeroCoefficient) {
    y = y.multiply(-1n);
  }
  const point = new Point(x, y, y.one, Fp2);
  if (!point.isOnCurve(B2)) {
    throw new Error('The given point is not on the twisted curve over Fp2');
  }
  return point;
}

function publicKeyFromG1(point: Point<bigint>) {
  return toBytesBE(compressG1(point), PUBLIC_KEY_LENGTH);
}

function publicKeyToG1(publicKey: Bytes) {
  return decompressG1(fromBytesBE(publicKey));
}

function signatureFromG2(point: Point<[bigint, bigint]>) {
  const [z1, z2] = compressG2(point);
  return concatTypedArrays(toBytesBE(z1, PUBLIC_KEY_LENGTH), toBytesBE(z2, PUBLIC_KEY_LENGTH));
}

export function signatureToG2(signature: Bytes) {
  const halfSignature = signature.length / 2;
  const z1 = fromBytesBE(signature.slice(0, halfSignature));
  const z2 = fromBytesBE(signature.slice(halfSignature));
  return decompressG2([z1, z2]);
}

export async function hashToG2(hash: Hash, domain: Bytes) {
  let xCoordinate = await getXCoordinate(hash, domain);
  let newResult: Fp2 | null = null;
  do {
    newResult = xCoordinate.pow(3n).add(new Fp2(4n, 4n)).sqrt();
    const addition = newResult ? xCoordinate.zero : xCoordinate.one;
    xCoordinate = xCoordinate.add(addition);
  } while (newResult === null);
  const yCoordinate: Fp2 = newResult;
  const result = new Point(xCoordinate, yCoordinate, new Fp2(1n, 0n), Fp2);
  return result.multiply(Fp2.COFACTOR);
}

// index
const P = CURVE.P;

// ## Fixed Generators
// Although any generator produced by hashing to $\mathbb{G}_1$ or $\mathbb{G}_2$ is
// safe to use in a cryptographic protocol, we specify some simple, fixed generators.
//
// In order to derive these generators, we select the lexicographically smallest
// valid $x$-coordinate and the lexicographically smallest corresponding $y$-coordinate,
// and then scale the resulting point by the cofactor, such that the result is not the
// identity. This results in the following fixed generators:

// Generator for curve over Fp
export const G1 = new Point(new Fp(CURVE.Gx), new Fp(CURVE.Gy), new Fp(1n), Fp);

// Generator for twisted curve over Fp2
export const G2 = new Point(
  new Fp2(CURVE.G2x[0], CURVE.G2x[1]),
  new Fp2(CURVE.G2y[0], CURVE.G2y[1]),
  new Fp2(1n, 0n),
  Fp2
);
// Create a function representing the line between P1 and P2, and evaluate it at T
// and evaluate it at T. Returns a numerator and a denominator
// to avoid unneeded divisions
function createLineBetween<T>(p1: Point<T>, p2: Point<T>, n: Point<T>) {
  let mNumerator = p2.y.multiply(p1.z).subtract(p1.y.multiply(p2.z));
  let mDenominator = p2.x.multiply(p1.z).subtract(p1.x.multiply(p2.z));
  if (!mNumerator.equals(mNumerator.zero) && mDenominator.equals(mDenominator.zero)) {
    return [n.x.multiply(p1.z).subtract(p1.x.multiply(n.z)), p1.z.multiply(n.z)];
  } else if (mNumerator.equals(mNumerator.zero)) {
    mNumerator = p1.x.square().multiply(3n);
    mDenominator = p1.y.multiply(p1.z).multiply(2n);
  }
  const numeratorLine = mNumerator.multiply(n.x.multiply(p1.z).subtract(p1.x.multiply(n.z)));
  const denominatorLine = mDenominator.multiply(n.y.multiply(p1.z).subtract(p1.y.multiply(n.z)));
  const z = mDenominator.multiply(n.z).multiply(p1.z);
  return [numeratorLine.subtract(denominatorLine), z];
}

function castPointToFp12(pt: Point<bigint>): Point<BigintTwelve> {
  if (pt.isEmpty()) {
    return new Point(new Fp12(), new Fp12(), new Fp12(), Fp12);
  }
  return new Point(
    new Fp12((pt.x as Fp).value, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n),
    new Fp12((pt.y as Fp).value, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n),
    new Fp12((pt.z as Fp).value, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n),
    Fp12
  );
}

// prettier-ignore
const PSEUDO_BINARY_ENCODING = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1
];

// Main miller loop
function millerLoop(
  Q: Point<BigintTwelve>,
  P: Point<BigintTwelve>,
  withFinalExponent: boolean = false
) {
  // prettier-ignore
  const one: Field<BigintTwelve> = new Fp12(
    1n, 0n, 0n, 0n,
    0n, 0n, 0n, 0n,
    0n, 0n, 0n, 0n
  );
  if (Q.isEmpty() || P.isEmpty()) {
    return one;
  }
  let R = Q;
  let fNumerator = one;
  let fDenominator = one;
  for (let i = PSEUDO_BINARY_ENCODING.length - 2; i >= 0n; i--) {
    const [n, d] = createLineBetween(R, R, P);
    fNumerator = fNumerator.square().multiply(n);
    fDenominator = fDenominator.square().multiply(d);
    R = R.double();
    if (PSEUDO_BINARY_ENCODING[i] === 1) {
      const [n, d] = createLineBetween(R, Q, P);
      fNumerator = fNumerator.multiply(n);
      fDenominator = fDenominator.multiply(d);
      R = R.add(Q);
    }
  }
  const f = fNumerator.div(fDenominator);
  return withFinalExponent ? finalExponentiate(f) : f;
}

export function pairing(
  Q: Point<BigintTuple>,
  P: Point<bigint>,
  withFinalExponent: boolean = true
) {
  if (!Q.isOnCurve(B2)) {
    throw new Error("Fisrt point isn't on elliptic curve");
  }
  if (!P.isOnCurve(B)) {
    throw new Error("Second point isn't on elliptic curve");
  }
  return millerLoop(Q.twist(), castPointToFp12(P), withFinalExponent);
}

export function getPublicKey(privateKey: PrivateKey) {
  privateKey = toBigInt(privateKey);
  return publicKeyFromG1(G1.multiply(privateKey));
}

const DOMAIN_LENGTH = 8;

export async function sign(message: Hash, privateKey: PrivateKey, domain: Domain) {
  domain = domain instanceof Uint8Array ? domain : toBytesBE(domain, DOMAIN_LENGTH);
  privateKey = toBigInt(privateKey);
  const messageValue = await hashToG2(message, domain);
  const signature = messageValue.multiply(privateKey);
  return signatureFromG2(signature);
}

export async function verify(
  message: Hash,
  publicKey: PublicKey,
  signature: Signature,
  domain: Domain
) {
  domain = domain instanceof Uint8Array ? domain : toBytesBE(domain, DOMAIN_LENGTH);
  const publicKeyPoint = publicKeyToG1(publicKey).negative();
  const signaturePoint = signatureToG2(signature);
  try {
    const signaturePairing = pairing(signaturePoint, G1);
    const hashPairing = pairing(await hashToG2(message, domain), publicKeyPoint);
    const finalExponent = finalExponentiate(signaturePairing.multiply(hashPairing));
    return finalExponent.equals(finalExponent.one);
  } catch {
    return false;
  }
}

export function aggregatePublicKeys(publicKeys: PublicKey[]) {
  if (publicKeys.length === 0) throw new Error('Expected non-empty array');
  const aggregatedPublicKey = publicKeys.reduce(
    (sum, publicKey) => sum.add(publicKeyToG1(publicKey)),
    Z1
  );
  return publicKeyFromG1(aggregatedPublicKey);
}

export function aggregateSignatures(signatures: Signature[]) {
  if (signatures.length === 0) throw new Error('Expected non-empty array');
  const aggregatedSignature = signatures.reduce(
    (sum, signature) => sum.add(signatureToG2(signature)),
    Z2
  );
  return signatureFromG2(aggregatedSignature);
}

export async function verifyBatch(
  messages: Hash[],
  publicKeys: PublicKey[],
  signature: Signature,
  domain: Domain
) {
  domain = domain instanceof Uint8Array ? domain : toBytesBE(domain, DOMAIN_LENGTH);
  if (messages.length === 0) throw new Error('Expected non-empty messages array');
  if (publicKeys.length !== messages.length) throw new Error('Pubkey count should equal msg count');
  try {
    let producer = new Fp12().one;
    for (const message of new Set(messages)) {
      const groupPublicKey = messages.reduce(
        (groupPublicKey, m, i) =>
          m !== message ? groupPublicKey : groupPublicKey.add(publicKeyToG1(publicKeys[i])),
        Z1
      );
      producer = producer.multiply(
        pairing(await hashToG2(message, domain), groupPublicKey) as Fp12
      );
    }
    producer = producer.multiply(pairing(signatureToG2(signature), G1.negative()) as Fp12);
    const finalExponent = finalExponentiate(producer);
    return finalExponent.equals(finalExponent.one);
  } catch {
    return false;
  }
}
