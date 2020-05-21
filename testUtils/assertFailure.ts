import { expect } from 'chai';

export async function assertFailure (promise: any) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  expect.fail();
}
