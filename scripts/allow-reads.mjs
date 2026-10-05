// beforeMCPExecution: reading the memory runs without asking each time; saving, correcting and forgetting
// still ask, as Cursor would. Any other server's tools are left to Cursor.
import { hookInput, reply } from "./core/lib.mjs";

const READS = new Set(["search", "fetch", "ask", "profile", "list_memories"]);
const input = await hookInput();
const ours = input.mcp_server_name === "geniffy" || /\/\/api\.geniffy\.com\/mcp\b/.test(String(input.url || ""));
reply(ours && READS.has(String(input.tool_name || "")) ? { permission: "allow" } : {});
