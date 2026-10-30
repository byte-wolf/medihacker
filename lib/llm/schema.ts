import { z } from "zod";

const quote = z.object({ passageId: z.string(), text: z.string() }).strict();
const calculation = z.object({
  type: z.enum(["difference", "bmi"]),
  inputs: z.array(z.object({ passageId: z.string(), value: z.number(), unit: z.string() }).strict()),
  result: z.number(),
}).strict();

/** Constrains syntax only; every clinical claim still passes the source verifier. */
export const chatResponse = z.object({
  items: z.array(z.object({
    key: z.string(),
    label: z.string(),
    status: z.enum(["documented", "not_documented"]),
    note: z.string().nullable(),
    facts: z.array(z.object({
      statement: z.string(),
      quotes: z.array(quote).min(1),
      calculation: calculation.nullable(),
    }).strict()),
  }).strict()).min(1),
}).strict();

export const chatResponseJsonSchema = z.toJSONSchema(chatResponse);
