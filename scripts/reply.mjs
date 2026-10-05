// afterAgentResponse: the agent's latest message in this turn. Only the last one is kept: it is the answer the
// turn ends with, after any "let me look" along the way.
import { hookInput, readJson, turnFile, writeJson } from "./core/lib.mjs";

const input = await hookInput();
const file = turnFile(input.conversation_id);
const turn = readJson(file);
if (turn && input.text) writeJson(file, { ...turn, reply: String(input.text) });
