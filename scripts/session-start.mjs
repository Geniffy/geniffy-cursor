// sessionStart: each Cursor chat starts knowing what Geniffy remembers about the person and this project.
import { hookInput, reply, sweepTurns } from "./core/lib.mjs";
import { recall } from "./core/memory.mjs";

const input = await hookInput();
sweepTurns();
const { text } = await recall(input.workspace_roots?.[0] || process.env.CURSOR_PROJECT_DIR || process.cwd());
reply({ additional_context: text });
