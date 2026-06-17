import logging
import time

from app.graph.state import CopilotState
from app.tools.git_tools import git_status
from app.tools.safety import is_command_allowed
from app.tools.terminal_tools import run_command


logger = logging.getLogger(__name__)


def tool_execution_node(state: CopilotState) -> CopilotState:
    query = state["query"].lower()
    logger.debug("graph_tool_execution - request query=%s", query[:200])
    trace = list(state.get("run_trace") or [])

    if "git status" in query:
        output = git_status(".")
        logger.debug("graph_tool_execution - executed git_status")
        trace.append(
            {
                "node": "tool_execution",
                "label": "Ran git status",
                "ts": time.time(),
                "detail": {"tool_name": "git_status"},
            }
        )
        return {"tool_results": [{"tool": "git_status", "output": output}], "run_trace": trace}

    if query.startswith("run "):
        command = state["query"][4:].strip()
        if not is_command_allowed(command):
            logger.warning("graph_tool_execution - blocked command=%s", command)
            trace.append(
                {
                    "node": "tool_execution",
                    "label": "Blocked tool command",
                    "ts": time.time(),
                    "detail": {"tool_name": "run_command", "error": "Blocked by safety policy"},
                }
            )
            return {
                "tool_results": [
                    {"tool": "run_command", "output": "Blocked by safety policy: command not allowed."}
                ],
                "run_trace": trace,
            }
        output = run_command(command)
        logger.debug("graph_tool_execution - executed run_command command=%s", command)
        trace.append(
            {
                "node": "tool_execution",
                "label": f"Ran command: {command[:48]}",
                "ts": time.time(),
                "detail": {"tool_name": "run_command"},
            }
        )
        return {"tool_results": [{"tool": "run_command", "output": output}], "run_trace": trace}

    logger.debug("graph_tool_execution - no action")
    trace.append(
        {
            "node": "tool_execution",
            "label": "No tool action taken",
            "ts": time.time(),
            "detail": {"tool_name": "none"},
        }
    )
    return {"tool_results": [{"tool": "none", "output": "No tool action taken."}], "run_trace": trace}
