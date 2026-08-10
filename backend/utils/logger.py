import logging
import json
from pathlib import Path

# Ensure logs directory exists (placed at project root /logs)
LOG_DIR = Path(__file__).resolve().parents[2] / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Configure a dedicated logger for task actions
task_logger = logging.getLogger('task_actions')
task_logger.setLevel(logging.INFO)

log_file_path = LOG_DIR / 'task_actions.log'
file_handler = logging.FileHandler(log_file_path, encoding='utf-8')
file_handler.setLevel(logging.INFO)

# Simple formatter that outputs timestamp and JSON payload
formatter = logging.Formatter('%(asctime)s %(message)s')
file_handler.setFormatter(formatter)

task_logger.addHandler(file_handler)

def log_task(action: str, task_dict: dict, extra: dict | None = None):
    """Log a task action with a JSON payload.

    Parameters
    ----------
    action: str
        Description of the action (e.g., 'added_task', 'edited_task').
    task_dict: dict
        The task data as returned by ``Task.to_dict()``.
    extra: dict | None
        Optional extra information (e.g., GCal sync result, error messages).
    """
    payload = {
        'action': action,
        'task': task_dict,
        'extra': extra or {}
    }
    # Encode as compact JSON for easier parsing later
    json_line = json.dumps(payload, ensure_ascii=False)
    task_logger.info(json_line)
