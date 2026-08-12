# pyright: reportCallIssue=false
from flask import Blueprint, request, jsonify, Response, g
from backend.extensions import db, notify_clients, clients
from queue import Queue, Empty
from backend.utils.logger import log_task
from backend.models import Task, Meal, Recipe, TaskCompletion, ActivityLog, User, Notification
from backend.utils.gcal import sync_task_to_gcal, sync_meal_to_gcal, delete_event
import json
import time
import os
import resend
from datetime import datetime

# Global dictionary to keep SSE client queues per home_id (imported from extensions)
# clients dict is defined in backend.extensions, no need to redefine here.


api_bp = Blueprint('api', __name__)

# Global dictionary to keep SSE client queues per home_id


@api_bp.route('/logs', methods=['GET'])
def get_logs():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    search = request.args.get('q', '', type=str)
    
    query = ActivityLog.query.filter_by(home_id=g.user.home_id)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.join(User, ActivityLog.user_id == User.id).filter(
            db.or_(
                ActivityLog.details.ilike(search_pattern),
                ActivityLog.action.ilike(search_pattern),
                User.display_name.ilike(search_pattern)
            )
        )
        
    query = query.order_by(ActivityLog.timestamp.desc())
    paginated = query.paginate(page=page, per_page=limit, error_out=False)
    
    return jsonify({
        'logs': [l.to_dict() for l in paginated.items],
        'has_next': paginated.has_next,
        'current_page': paginated.page,
        'total_pages': paginated.pages
    })

@api_bp.route('/stream')
def stream():
    # Capture home_id outside the generator so it isn't dependent on request context
    home_id = getattr(g, 'user', None).home_id if hasattr(g, 'user') else None
    
    def event_stream(h_id):
        if not h_id:
            return
            
        q = Queue()
        if h_id not in clients:
            clients[h_id] = []
        clients[h_id].append(q)
        try:
            while True:
                try:
                    # Wait up to 20 seconds for a message
                    msg = q.get(timeout=20)
                    yield msg
                except Empty:
                    # Send a keep-alive comment to prevent 504 timeouts on reverse proxies like Cloudflare/Nginx
                    yield ": keepalive\n\n"
        except GeneratorExit:
            if q in clients[h_id]:
                clients[h_id].remove(q)
                
    return Response(event_stream(home_id), content_type='text/event-stream')


@api_bp.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.filter_by(home_id=g.user.home_id).all()
    return jsonify([t.to_dict() for t in tasks])

@api_bp.route('/tasks', methods=['POST'])
def save_tasks():
    td = request.json
    if not td:
        return jsonify({'error': 'No data provided'}), 400
        
    raw_task_id = td.get('id')
    is_temp_id = isinstance(raw_task_id, str) and raw_task_id.startswith('temp-')
    
    task = None
    if not is_temp_id and raw_task_id is not None:
        try:
            task_id = int(raw_task_id)
            task = Task.query.filter_by(id=task_id, home_id=g.user.home_id).first()
        except ValueError:
            task = None
    
    action_type = 'edited_task'
    old_data = task.to_dict() if task else {}
    
    if not task:
        task = Task(home_id=g.user.home_id)
        db.session.add(task)
        action_type = 'added_task'
        
    task.title = td.get('title')
    task.description = td.get('description')
    task.icon = td.get('icon')
    task.room = td.get('roomId') or td.get('room')
    task.color = td.get('color') or task.color
    task.recurrence = td.get('recurrence')
    task.interval = td.get('interval', 1)
    task.customDays = json.dumps(td.get('customDays', []))
    task.endType = td.get('endType')
    task.endDate = td.get('endDate')
    task.endOccurrences = td.get('endOccurrences')
    task.startDate = td.get('startDate')
    task.allDay = td.get('allDay', True)
    task.time = td.get('time')
    
    new_assignees = td.get('assignees', [])
    task.assignees_rel = []
    for uname in new_assignees:
        user = User.query.filter_by(username=uname, home_id=g.user.home_id).first()
        if not user:
            user = User.query.filter_by(display_name=uname, home_id=g.user.home_id).first()
        if user:
            task.assignees_rel.append(user)
            
    task.rotate = td.get('rotate', False)
    task.createdAt = td.get('createdAt')
    task.isMeal = td.get('isMeal', False)
    task.recipeId = td.get('recipeId')
    
    # Compute Diff
    new_data = task.to_dict()
    diff = {}
    if action_type == 'edited_task':
        for k, v in new_data.items():
            if k not in ['id', 'homeId', 'createdAt'] and old_data.get(k) != v:
                diff[k] = {'old': old_data.get(k), 'new': v}
    else:
        # For added tasks, we can store the whole object or just title as new
        diff['title'] = {'old': None, 'new': new_data.get('title')}
        
    db.session.commit()
    
    # Sync with Google Calendar if enabled
    # Sync with Google Calendar if enabled and log result
    if g.user.google_access_token:
        sync_success = sync_task_to_gcal(g.user, task)
        log_task('gcal_sync', task.to_dict(), {'success': sync_success})
    
    
    # Activity Log
    if action_type == 'added_task' or diff: # Only log edits if there is a real diff
        log = ActivityLog(
            home_id=g.user.home_id,
            user_id=g.user.id,
            action=action_type,
            details=task.title,
            payload=json.dumps({'changes': diff}),
            timestamp=datetime.utcnow()
        )
        db.session.add(log)
        db.session.commit()
    
    # Notify clients about task update
    notify_clients(g.user.home_id, 'tasks_updated', {})
    
    # Send per-user notifications for newly assigned members
    new_assignees = td.get('assignees', [])
    old_assignees = old_data.get('assignees', []) if old_data else []
    added_assignees = [a for a in new_assignees if a not in old_assignees]
    
    if added_assignees:
        # Find the users by username and create notifications for them
        home_members = User.query.filter_by(home_id=g.user.home_id).all()
        for member in home_members:
            # assignees can be stored as username OR display_name — check both
            if (member.username in added_assignees or (member.display_name and member.display_name in added_assignees)) and member.id != g.user.id:
                notif = Notification(
                    home_id=g.user.home_id,
                    user_id=member.id,
                    actor_id=g.user.id,
                    type='task_assigned',
                    title='New Task Assigned',
                    body=f'{g.user.display_name or g.user.username} assigned you a task: {task.title}',
                    is_read=False,
                    timestamp=datetime.utcnow()
                )
                db.session.add(notif)
        db.session.commit()
        # Broadcast per-user notification via SSE
        notify_clients(g.user.home_id, 'notifications_updated', {})
    
    return jsonify({'success': True, 'task': task.to_dict(), 'tempId': raw_task_id if is_temp_id else None})

@api_bp.route('/tasks/<task_id>/complete', methods=['POST'])
def complete_task(task_id):
    data = request.json or {}
    date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    # Handle meals polymorphic completion
    if str(task_id).startswith('meal-'):
        real_id = int(str(task_id).replace('meal-', ''))
        meal = db.session.get(Meal, real_id)
        if meal and not meal.completed:
            meal.completed = True
            g.user.points = (g.user.points or 0) + 10
            db.session.commit()
            notify_clients(g.user.home_id, 'member_points_updated', {'userId': g.user.id, 'points': g.user.points})
            notify_clients(g.user.home_id, 'meals_updated', {})
            return jsonify({'status': 'ok', 'points': g.user.points})
        return jsonify({'status': 'already_completed'})
        
    try:
        task_id = int(task_id)
    except ValueError:
        return jsonify({'error': 'Invalid task ID'}), 400
        
    # Check if already completed
    existing = TaskCompletion.query.filter_by(task_id=task_id, date=date_str).first()
    if existing:
        return jsonify({'status': 'already_completed'})
        
    completion = TaskCompletion(
        task_id=task_id,
        home_id=g.user.home_id,
        user_id=g.user.id,
        date=date_str,
        completedAt=datetime.utcnow().isoformat() + 'Z'
    )
    db.session.add(completion)

    # Add 10 points to the user
    g.user.points = (g.user.points or 0) + 10
    
    # Activity Log
    task = db.session.get(Task, task_id)
    task_title = task.title if task else "a task"
    log = ActivityLog(
        home_id=g.user.home_id,
        user_id=g.user.id,
        action='completed_task',
        details=task_title,
        timestamp=datetime.utcnow()
    )
    db.session.add(log)
    
    db.session.commit()
    
    # Notify clients about points update and task completion
    notify_clients(g.user.home_id, 'member_points_updated', {'userId': g.user.id, 'points': g.user.points})
    notify_clients(g.user.home_id, 'tasks_updated', {})
    return jsonify({'status': 'ok', 'points': g.user.points, 'completion': completion.to_dict()})

@api_bp.route('/tasks/<task_id>/incomplete', methods=['POST'])
def incomplete_task(task_id):
    data = request.json or {}
    date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    # Handle meals polymorphic completion
    if str(task_id).startswith('meal-'):
        real_id = int(str(task_id).replace('meal-', ''))
        meal = db.session.get(Meal, real_id)
        if meal and meal.completed:
            meal.completed = False
            g.user.points = max(0, (g.user.points or 0) - 10)
            db.session.commit()
            notify_clients(g.user.home_id, 'member_points_updated', {'userId': g.user.id, 'points': g.user.points})
            notify_clients(g.user.home_id, 'meals_updated', {})
        return jsonify({'status': 'ok'})
        
    try:
        task_id = int(task_id)
    except ValueError:
        return jsonify({'error': 'Invalid task ID'}), 400
        
    completion = TaskCompletion.query.filter_by(task_id=task_id, date=date_str).first()
    if completion:
        db.session.delete(completion)
        g.user.points = max(0, (g.user.points or 0) - 10)
        
        # Activity Log
        task = db.session.get(Task, task_id)
        log = ActivityLog(
            home_id=g.user.home_id,
            user_id=g.user.id,
            action='uncompleted_task',
            details=task.title if task else "a task",
            timestamp=datetime.utcnow()
        )
        db.session.add(log)
        
        db.session.commit()
        notify_clients(g.user.home_id, 'member_points_updated', {'userId': g.user.id, 'points': g.user.points})
        notify_clients(g.user.home_id, 'tasks_updated', {})
    return jsonify({'status': 'ok'})

@api_bp.route('/completions', methods=['GET'])
def get_completions():
    completions = TaskCompletion.query.filter_by(home_id=g.user.home_id).all()
    return jsonify([c.to_dict() for c in completions])

@api_bp.route('/meals', methods=['GET'])
def get_meals():
    meals = Meal.query.filter_by(home_id=g.user.home_id).all()
    result = {}
    for m in meals:
        if m.date not in result:
            result[m.date] = []
        result[m.date].append(m.to_dict())
    return jsonify(result)

@api_bp.route('/meals', methods=['POST'])
def save_meals():
    data = request.json
    
    # 1. Fetch existing meals
    existing_meals = {m.id: m for m in Meal.query.filter_by(home_id=g.user.home_id).all()}
    new_meal_ids = set()
    
    # 2. Process incoming meals
    pending_cook_notifs = []  # list of (cook_username, meal_title, date)
    for date, meal_list in data.items():
        for md in meal_list:
            raw_m_id = md.get('id')
            is_temp_id = isinstance(raw_m_id, str) and raw_m_id.startswith('temp-')
            
            m_id = None
            if not is_temp_id and raw_m_id is not None:
                try:
                    m_id = int(raw_m_id)
                except ValueError:
                    pass
            
            if m_id is not None:
                new_meal_ids.add(m_id)
            
            title = md.get('title') or md.get('name')
            
            if m_id is None or m_id not in existing_meals:
                # Add new meal
                meal = Meal(
                    home_id=g.user.home_id,
                    date=date,
                    title=title,
                    recipeId=md.get('recipeId'),
                    cook=md.get('cook'),
                    completed=md.get('completed', False),
                    type=md.get('type'),
                    emoji=md.get('emoji')
                )
                db.session.add(meal)
                db.session.flush() # To ensure it's in session
                
                log = ActivityLog(
                    home_id=g.user.home_id,
                    user_id=g.user.id,
                    action='updated_meals',
                    details=f"Added '{title}' to {date}",
                    payload=json.dumps({'changes': {'title': {'old': None, 'new': title}}}),
                    timestamp=datetime.utcnow()
                )
                db.session.add(log)
                # Track cook notification for new meals
                cook_name = md.get('cook')
                if cook_name and cook_name not in ('Anyone', 'anyone', ''):
                    pending_cook_notifs.append((cook_name, title, date))
                    
                # Google Calendar sync is handled at the end of the loop
            else:
                # Update existing
                em = existing_meals[m_id]
                diff = {}
                old_data = em.to_dict()
                
                em.date = date
                em.title = title
                em.recipeId = md.get('recipeId')
                em.cook = md.get('cook')
                em.completed = md.get('completed', False)
                em.type = md.get('type')
                em.emoji = md.get('emoji')
                
                new_data = em.to_dict()
                for k, v in new_data.items():
                    if k not in ['id', 'homeId'] and old_data.get(k) != v:
                        diff[k] = {'old': old_data.get(k), 'new': v}
                        
                if diff:
                    log = ActivityLog(
                        home_id=g.user.home_id,
                        user_id=g.user.id,
                        action='updated_meals',
                        details=f"Updated '{title}'",
                        payload=json.dumps({'changes': diff}),
                        timestamp=datetime.utcnow()
                    )
                    db.session.add(log)
                
                # Track cook notification if cook was newly assigned or changed
                old_cook = old_data.get('cook')
                new_cook = md.get('cook')
                if new_cook and new_cook != old_cook and new_cook not in ('Anyone', 'anyone', ''):
                    pending_cook_notifs.append((new_cook, title, date))
                    
            if g.user.google_access_token:
                current_meal = meal if (m_id is None or m_id not in existing_meals) else em
                recipe = db.session.get(Recipe, current_meal.recipeId) if current_meal.recipeId else None
                sync_meal_to_gcal(g.user, current_meal, recipe)

    # 3. Handle deleted meals
    for em_id, em in existing_meals.items():
        if em_id not in new_meal_ids:
            db.session.delete(em)
            log = ActivityLog(
                home_id=g.user.home_id,
                user_id=g.user.id,
                action='updated_meals',
                details=f"Deleted '{em.title}' from {em.date}",
                payload=json.dumps({'changes': {'title': {'old': em.title, 'new': None}}}),
                timestamp=datetime.utcnow()
            )
            db.session.add(log)
            if g.user.google_access_token and em.google_event_id:
                delete_event(g.user, em.google_event_id)
            
    db.session.commit()
    
    # Send cook notifications
    if pending_cook_notifs:
        home_members = User.query.filter_by(home_id=g.user.home_id).all()
        for cook_name, meal_title, meal_date in pending_cook_notifs:
            for member in home_members:
                if (member.username == cook_name or member.display_name == cook_name) and member.id != g.user.id:
                    notif = Notification(
                        home_id=g.user.home_id,
                        user_id=member.id,
                        actor_id=g.user.id,
                        type='meal_assigned',
                        title='New Meal Assigned',
                        body=f'{g.user.display_name or g.user.username} assigned you to cook: {meal_title} on {meal_date}',
                        is_read=False,
                        timestamp=datetime.utcnow()
                    )
                    db.session.add(notif)
        db.session.commit()
        notify_clients(g.user.home_id, 'notifications_updated', {})
    
    notify_clients(g.user.home_id, 'meals_updated', data)
    return jsonify({'success': True})

@api_bp.route('/recipes', methods=['GET'])
def get_recipes():
    recipes = Recipe.query.filter_by(home_id=g.user.home_id).all()
    return jsonify([r.to_dict() for r in recipes])

@api_bp.route('/recipes', methods=['POST'])
def save_recipes():
    data = request.json
    
    existing_recipes = {r.id: r for r in Recipe.query.filter_by(home_id=g.user.home_id).all()}
    new_recipe_ids = set()
    
    for rd in data:
        raw_r_id = rd.get('id')
        is_temp_id = isinstance(raw_r_id, str) and raw_r_id.startswith('temp-')
        
        r_id = None
        if not is_temp_id and raw_r_id is not None:
            try:
                r_id = int(raw_r_id)
            except ValueError:
                pass
                
        if r_id is not None:
            new_recipe_ids.add(r_id)
            
        title = rd.get('name') or rd.get('title')
        
        if r_id is None or r_id not in existing_recipes:
            # Add new
            recipe = Recipe(
                home_id=g.user.home_id,
                title=title,
                time=rd.get('time'),
                image=rd.get('emoji') or rd.get('image'),
                category=rd.get('category'),
                ingredients=json.dumps(rd.get('ingredients', [])),
                notes=rd.get('notes')
            )
            db.session.add(recipe)
            db.session.flush()
            
            log = ActivityLog(
                home_id=g.user.home_id,
                user_id=g.user.id,
                action='updated_recipes',
                details=f"Added recipe '{title}'",
                payload=json.dumps({'changes': {'title': {'old': None, 'new': title}}}),
                timestamp=datetime.utcnow()
            )
            db.session.add(log)
        else:
            # Update existing
            er = existing_recipes[r_id]
            old_data = er.to_dict()
            diff = {}
            
            er.title = title
            er.time = rd.get('time')
            er.image = rd.get('emoji') or rd.get('image')
            er.category = rd.get('category')
            er.ingredients = json.dumps(rd.get('ingredients', []))
            er.notes = rd.get('notes')
            
            new_data = er.to_dict()
            for k, v in new_data.items():
                if k not in ['id', 'homeId'] and old_data.get(k) != v:
                    diff[k] = {'old': old_data.get(k), 'new': v}
                    
            if diff:
                log = ActivityLog(
                    home_id=g.user.home_id,
                    user_id=g.user.id,
                    action='updated_recipes',
                    details=f"Updated recipe '{title}'",
                    payload=json.dumps({'changes': diff}),
                    timestamp=datetime.utcnow()
                )
                db.session.add(log)
                
    for er_id, er in existing_recipes.items():
        if er_id not in new_recipe_ids:
            db.session.delete(er)
            log = ActivityLog(
                home_id=g.user.home_id,
                user_id=g.user.id,
                action='updated_recipes',
                details=f"Deleted recipe '{er.title}'",
                payload=json.dumps({'changes': {'title': {'old': er.title, 'new': None}}}),
                timestamp=datetime.utcnow()
            )
            db.session.add(log)
            
    db.session.commit()
    notify_clients(g.user.home_id, 'recipes_updated', data)
    return jsonify({'success': True})

@api_bp.route('/activity-logs', methods=['GET'])
def get_activity_logs():
    home_id = g.user.home_id
    logs = ActivityLog.query.filter_by(home_id=home_id).order_by(ActivityLog.timestamp.desc()).limit(50).all()
    
    return jsonify({
        'logs': [{
            'id': l.id,
            'user_id': l.user_id,
            'action': l.action,
            'details': l.details,
            'timestamp': l.timestamp.isoformat() + 'Z'
        } for l in logs]
    })

@api_bp.route('/notifications', methods=['GET'])
def get_notifications():
    notifs = Notification.query.filter_by(
        user_id=g.user.id,
        home_id=g.user.home_id
    ).order_by(Notification.timestamp.desc()).limit(30).all()
    unread_count = Notification.query.filter_by(
        user_id=g.user.id,
        home_id=g.user.home_id,
        is_read=False
    ).count()
    return jsonify({
        'notifications': [n.to_dict() for n in notifs],
        'unread_count': unread_count
    })

@api_bp.route('/notifications/<notif_id>/read', methods=['POST'])
def mark_notification_read(notif_id):
    notif = Notification.query.filter_by(id=notif_id, user_id=g.user.id).first()
    if notif:
        notif.is_read = True
        db.session.commit()
    return jsonify({'status': 'ok'})

@api_bp.route('/notifications/read-all', methods=['POST'])
def mark_all_notifications_read():
    Notification.query.filter_by(
        user_id=g.user.id,
        home_id=g.user.home_id,
        is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify({'status': 'ok'})
