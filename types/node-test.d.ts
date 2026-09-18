declare module "node:test" {
  type TestFunction = (name: string, fn: () => void | Promise<void>) => void;
  const test: TestFunction;
  export default test;
}
declare module "node:assert/strict" {
  interface Assert {
    equal(actual: unknown, expected: unknown): void; deepEqual(actual: unknown, expected: unknown): void;
    match(actual:string,expected:RegExp):void; ok(actual:unknown):void;
    throws(fn:()=>unknown,expected?:RegExp):void; doesNotThrow(fn:()=>unknown):void;
    rejects(fn:()=>Promise<unknown>,expected?:RegExp):Promise<void>;
  }
  const assert: Assert;
  export default assert;
}
