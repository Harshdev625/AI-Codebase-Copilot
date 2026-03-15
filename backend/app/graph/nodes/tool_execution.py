from app.graph.state import CopilotState
from app.tools.git_tools import git_status
from app.tools.safety import is_command_allowed
from app.tools.terminal_tools import run_command


def tool_execution_node(state: CopilotState) -> CopilotState:
    query = state["query"].lower()

    if "git status" in query:
        output = git_status(".")
        return {"tool_results": [{"tool": "git_status", "output": output}]}

    if query.startswith("run "):
        command = state["query"][4:].strip()
        if not is_command_allowed(command):
            return {
                "tool_results": [
                    {"tool": "run_command", "output": "Blocked by safety policy: command not allowed."}
                ]
            }
        output = run_command(command)
        return {"tool_results": [{"tool": "run_command", "output": output}]}

    return {"tool_results": [{"tool": "none", "output": "No tool action taken."}]}
