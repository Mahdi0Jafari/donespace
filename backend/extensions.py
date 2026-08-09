from flask_sqlalchemy import SQLAlchemy
import json

db = SQLAlchemy()

# We now store queues by home_id: { home_id: [queue1, queue2] }
clients = {}

def notify_clients(home_id, event_type, data):
    if home_id not in clients:
        return
    message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    for client_queue in clients[home_id]:
        client_queue.put(message)
