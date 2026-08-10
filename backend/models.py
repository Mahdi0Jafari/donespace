from backend.extensions import db
import json
import time
from datetime import datetime

# Association table for Task Assignees
task_assignee = db.Table('task_assignee',
    db.Column('task_id', db.Integer, db.ForeignKey('task.id', ondelete='CASCADE'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), primary_key=True)
)

class Home(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    join_code = db.Column(db.String(10), unique=True, nullable=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

class UserHome(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), primary_key=True)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), primary_key=True)
    role = db.Column(db.String(20), default='member') # 'owner' or 'member'

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True, nullable=False)
    avatar = db.Column(db.Text) # Image URL
    password_hash = db.Column(db.String(255), nullable=False)
    # home_id now represents the 'currently active' home
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='SET NULL'), nullable=True)
    token = db.Column(db.String(100), unique=True)
    points = db.Column(db.Integer, default=0)
    
    # Google OAuth & Calendar Integration
    google_id = db.Column(db.String(100), unique=True, nullable=True)
    google_access_token = db.Column(db.Text, nullable=True)
    google_refresh_token = db.Column(db.Text, nullable=True)
    google_token_expiry = db.Column(db.DateTime, nullable=True)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name or self.username,
            'email': self.email,
            'avatar': self.avatar,
            'home_id': self.home_id,
            'points': self.points
        }

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(50))
    room = db.Column(db.String(50))
    recurrence = db.Column(db.String(50))
    interval = db.Column(db.Integer, default=1)
    customDays = db.Column(db.String(50)) # stored as JSON string "[1, 3]"
    endType = db.Column(db.String(50))
    endDate = db.Column(db.String(50))
    endOccurrences = db.Column(db.Integer)
    startDate = db.Column(db.String(50))
    allDay = db.Column(db.Boolean, default=True)
    time = db.Column(db.String(50))
    rotate = db.Column(db.Boolean, default=False)
    createdAt = db.Column(db.String(50))
    isMeal = db.Column(db.Boolean, default=False)
    recipeId = db.Column(db.Integer, nullable=True)
    google_event_id = db.Column(db.String(255), nullable=True)
    
    assignees_rel = db.relationship('User', secondary=task_assignee, lazy='subquery', backref=db.backref('tasks', lazy=True))

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'icon': self.icon,
            'roomId': self.room,
            'room': self.room,
            'recurrence': self.recurrence,
            'interval': self.interval,
            'customDays': json.loads(self.customDays) if self.customDays else [],
            'endType': self.endType,
            'endDate': self.endDate,
            'endOccurrences': self.endOccurrences,
            'startDate': self.startDate,
            'allDay': self.allDay,
            'time': self.time,
            'assignees': [u.username for u in self.assignees_rel],
            'rotate': self.rotate,
            'createdAt': self.createdAt,
            'isMeal': self.isMeal,
            'recipeId': self.recipeId
        }

class TaskCompletion(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id', ondelete='CASCADE'), nullable=False)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.String(50), nullable=False) # e.g. YYYY-MM-DD
    completedAt = db.Column(db.String(50)) # ISO string

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'taskId': self.task_id,
            'homeId': self.home_id,
            'userId': self.user_id,
            'date': self.date,
            'completedAt': self.completedAt
        }

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    action = db.Column(db.String(50), nullable=False) # e.g., 'added_task', 'completed_task', 'deleted_task'
    details = db.Column(db.Text) # e.g., 'Vacuum House'
    payload = db.Column(db.Text) # JSON diff string
    timestamp = db.Column(db.DateTime, nullable=False)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
    def to_dict(self):
        user = db.session.get(User, self.user_id)
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': user.display_name if user else 'Unknown',
            'user_avatar': user.avatar if user else None,
            'action': self.action,
            'details': self.details,
            'payload': json.loads(self.payload) if self.payload else None,
            'timestamp': self.timestamp.isoformat() + 'Z' if self.timestamp else None
        }

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)  # recipient
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True)  # who triggered it
    type = db.Column(db.String(50), nullable=False)  # e.g. 'task_assigned'
    title = db.Column(db.String(200))
    body = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
    def to_dict(self):
        actor = db.session.get(User, self.actor_id) if self.actor_id else None
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'body': self.body,
            'is_read': self.is_read,
            'timestamp': self.timestamp.isoformat() + 'Z' if self.timestamp else None,
            'actor_name': actor.display_name if actor else 'Someone',
            'actor_avatar': actor.avatar if actor else None,
        }

class Meal(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.String(50), nullable=False) # YYYY-MM-DD
    title = db.Column(db.String(200))
    recipeId = db.Column(db.Integer, nullable=True)
    cook = db.Column(db.String(50))
    completed = db.Column(db.Boolean, default=False)
    type = db.Column(db.String(50))
    emoji = db.Column(db.String(10))
    google_event_id = db.Column(db.String(255), nullable=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date,
            'title': self.title,
            'recipeId': self.recipeId,
            'cook': self.cook,
            'completed': self.completed,
            'type': self.type,
            'emoji': self.emoji,
            'name': self.title
        }

class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    home_id = db.Column(db.Integer, db.ForeignKey('home.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    time = db.Column(db.String(50))
    image = db.Column(db.String(255))
    category = db.Column(db.String(50))
    ingredients = db.Column(db.Text) # JSON list
    notes = db.Column(db.Text)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.title,  # Frontend uses name
            'title': self.title,
            'time': self.time,
            'emoji': self.image, # Frontend uses emoji
            'image': self.image,
            'category': self.category or 'dinner',
            'ingredients': json.loads(self.ingredients) if self.ingredients else [],
            'notes': self.notes
        }
