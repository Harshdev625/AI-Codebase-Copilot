import logging

from app.graph.state import CopilotState
from app.tools.git_tools import git_status
from app.tools.safety import is_command_allowed
from app.tools.terminal_tools import run_command


logger = logging.getLogger(__name__)


def tool_execution_node(state: CopilotState) -> CopilotState:
    query = state["query"].lower()
    logger.debug("graph_tool_execution - request query=%s", query[:200])

    if "git status" in query:
        output = git_status(".")
        logger.debug("graph_tool_execution - executed git_status")
        return {"tool_results": [{"tool": "git_status", "output": output}]}

    if query.startswith("run "):
        command = state["query"][4:].strip()
        if not is_command_allowed(command):
            logger.warning("graph_tool_execution - blocked command=%s", command)
            return {
                "tool_results": [
                    {"tool": "run_command", "output": "Blocked by safety policy: command not allowed."}
                ]
            }
        output = run_command(command)
        logger.debug("graph_tool_execution - executed run_command command=%s", command)
        return {"tool_results": [{"tool": "run_command", "output": output}]}

    logger.debug("graph_tool_execution - no action")
    return {"tool_results": [{"tool": "none", "output": "No tool action taken."}]}
