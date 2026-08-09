import requests
import json

BASE_URL = 'http://localhost:5000/api'

def test_tasks():
    print("Testing Tasks...")
    task_data = {
        'id': 'test-task-1',
        'title': 'Test Task',
        'description': 'A task to test the API',
        'icon': '🧹',
        'room': 'living_room',
        'recurrence': 'weekly',
        'interval': 2,
        'customDays': [1, 3, 5],
        'endType': 'occurrences',
        'endDate': None,
        'endOccurrences': 10,
        'startDate': '2026-08-05',
        'allDay': False,
        'time': '14:00',
        'assignees': ['Me', 'Scarlett'],
        'rotate': True,
        'createdAt': '2026-08-05T10:00:00Z',
        'isMeal': False
    }
    
    res = requests.post(f'{BASE_URL}/tasks', json=task_data)
    assert res.status_code == 201, f"Failed to create task: {res.text}"
    print("  Create: OK")
    
    res = requests.get(f'{BASE_URL}/tasks')
    tasks = res.json()
    assert len(tasks) > 0, "No tasks returned"
    
    saved_task = next((t for t in tasks if t['id'] == 'test-task-1'), None)
    assert saved_task is not None, "Task not found in GET"
    assert saved_task['customDays'] == [1, 3, 5], f"customDays mismatch: {saved_task['customDays']}"
    assert saved_task['assignees'] == ['Me', 'Scarlett'], f"assignees mismatch: {saved_task['assignees']}"
    assert saved_task['endOccurrences'] == 10, f"endOccurrences mismatch: {saved_task['endOccurrences']}"
    print("  Verify Fields: OK")
    
    res = requests.delete(f'{BASE_URL}/tasks/test-task-1')
    assert res.status_code == 200, "Failed to delete task"
    print("  Delete: OK")

if __name__ == '__main__':
    try:
        test_tasks()
        print("All tests passed!")
    except Exception as e:
        print(f"Test failed: {e}")
