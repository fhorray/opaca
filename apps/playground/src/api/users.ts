import { createGET, createPOST } from "opaca/server";

const users: any[] = [];

// GET /api/users
export const GET = createGET(async ({ res }) => {
  return res.json(users);
});

// POST /api/users
export const POST = createPOST(async ({ req, res }) => {
  const body = await req.json();
  users.push(body);
  return res.json(body, 201);
});
