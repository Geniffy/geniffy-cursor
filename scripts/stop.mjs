// stop: the turn is over. Its prompts and final answer are handed to a process of their own to save
// (core/outbox.mjs), so the chat never waits on the network.
import { hookInput, readJson, removeFile, reply, turnFile } from "./core/lib.mjs";
import { saveLater } from "./core/outbox.mjs";

const input = await hookInput();
const file = turnFile(input.conversation_id);
const turn = readJson(file);
removeFile(file);
if (turn && input.status !== "error") saveLater(turn.prompts, turn.reply, turn.cwd);
reply({});
