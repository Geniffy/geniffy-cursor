// beforeSubmitPrompt: "geniffy login" and the other Geniffy commands are answered here and never reach the
// model; any other prompt is kept until the turn ends, so the two sides can be saved together. No network
// for an ordinary prompt, so it goes on exactly as typed.
import { canSave, hookInput, readJson, reply, turnFile, writeJson } from "./core/lib.mjs";
import { command, run } from "./core/commands.mjs";

const input = await hookInput();
const prompt = String(input.prompt || "").trim();
const name = command(prompt);
if (name) {
  reply({ continue: false, user_message: await run(name) });
} else {
  if (prompt && canSave()) {
    const file = turnFile(input.conversation_id);
    const turn = readJson(file) || { prompts: [] };
    turn.prompts.push(prompt);
    turn.cwd = input.workspace_roots?.[0] || turn.cwd;
    writeJson(file, turn);
  }
  reply({ continue: true });
}
