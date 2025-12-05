import { createGET } from "opaca/server";

export const GET = createGET(async ({ res }) => {
  return res.json({
    ok: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

