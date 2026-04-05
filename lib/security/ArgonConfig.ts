const ARGON2_MEMORY_COST = Number(process.env.ARGON2_MEMORY_COST) || 2 ** 16;
const ARGON2_TIME_COST = Number(process.env.ARGON2_TIME_COST) || 3;
const ARGON2_PARALLELISM = Number(process.env.ARGON2_PARALLELISM) || 1;

import * as argon2 from "argon2";

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
  });
}

async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hashedPassword, password);
  } catch {
    return false;
  }
}

export {
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
  hashPassword,
  verifyPassword,
};
