import os
import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from backend.extensions import db

# The scopes required for Calendar and Profile
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

def get_credentials(user):
    """Rebuilds credentials from the user object and refreshes if needed."""
    if not user.google_access_token:
        return None
        
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    
    # Check if we have credentials in env, if not it won't work
    if not client_id or not client_secret:
        return None

    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES
    )

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Update user in DB
            user.google_access_token = creds.token
            if creds.expiry:
                user.google_token_expiry = creds.expiry
            db.session.commit()
        except Exception as e:
            print(f"Failed to refresh Google credentials: {e}")
            return None

    return creds

def get_calendar_service(user):
    creds = get_credentials(user)
    if not creds:
        return None
    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        print(f"Failed to build calendar service: {e}")
        return None

def ensure_donespace_calendar(service):
    """Finds or creates a 'DoneSpace' calendar."""
    try:
        # Check existing calendars
        page_token = None
        while True:
            calendar_list = service.calendarList().list(pageToken=page_token).execute()
            for calendar_list_entry in calendar_list['items']:
                if calendar_list_entry['summary'] == 'DoneSpace':
                    return calendar_list_entry['id']
            page_token = calendar_list.get('nextPageToken')
            if not page_token:
                break
        
        # Not found, create it
        calendar = {
            'summary': 'DoneSpace',
            'timeZone': 'UTC',
            'description': 'Tasks and Meals from DoneSpace.ir'
        }
        created_calendar = service.calendars().insert(body=calendar).execute()
        return created_calendar['id']
    except Exception as e:
        print(f"Failed to ensure calendar: {e}")
        return 'primary' # Fallback to primary

def parse_date_to_iso(date_str, time_str=None, all_day=True):
    """Converts local date strings to ISO format for Google Calendar."""
    # This is a simple parser. In production, we'd use robust timezone handling.
    # date_str is usually "YYYY-MM-DD"
    # time_str could be "14:30"
    if not date_str:
        date_str = datetime.datetime.now().strftime('%Y-%m-%d')
        
    if all_day:
        # For all-day events, Google just wants "YYYY-MM-DD"
        return {'date': date_str}
    
    if not time_str:
        time_str = "09:00" # default
        
    dt_str = f"{date_str}T{time_str}:00"
    # Simple naive datetime string to let Google assume local timezone or UTC
    return {
        'dateTime': dt_str,
        'timeZone': 'UTC'
    }

def sync_task_to_gcal(user, task):
    """Creates or updates a task as a Google Calendar Event."""
    service = get_calendar_service(user)
    if not service:
        return False
        
    calendar_id = ensure_donespace_calendar(service)
    
    # Build event payload
    event = {
        'summary': f"{task.icon or '📝'} {task.title}",
        'description': task.description or "DoneSpace Task",
        'extendedProperties': {
            'private': {
                'task_id': str(task.id),
                'type': 'task'
            }
        },
        'reminders': {
            'useDefault': False,
            'overrides': [
                {'method': 'popup', 'minutes': 30},
            ],
        },
        'transparency': 'transparent' # "Available" so it doesn't block schedule
    }
    
    # Time/Date logic
    if task.allDay:
        # All day event needs start date and end date (end date is exclusive in GCal)
        start_date = parse_date_to_iso(task.startDate or datetime.datetime.now().strftime('%Y-%m-%d'), all_day=True)
        # Add 1 day for end date
        end_dt = datetime.datetime.strptime(start_date['date'], "%Y-%m-%d") + datetime.timedelta(days=1)
        end_date = {'date': end_dt.strftime("%Y-%m-%d")}
        event['start'] = start_date
        event['end'] = end_date
    else:
        # Specific time
        start_time = parse_date_to_iso(task.startDate, task.time, all_day=False)
        event['start'] = start_time
        # Default duration 1 hour
        end_dt = datetime.datetime.strptime(start_time['dateTime'], "%Y-%m-%dT%H:%M:%S") + datetime.timedelta(hours=1)
        event['end'] = {
            'dateTime': end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            'timeZone': 'UTC'
        }
        
    # Recurrence logic (simple RRule conversion if available)
    if task.recurrence and task.recurrence != 'none':
        rrule = []
        if task.recurrence == 'daily':
            rrule.append(f"RRULE:FREQ=DAILY;INTERVAL={task.interval or 1}")
        elif task.recurrence == 'weekly':
            rrule.append(f"RRULE:FREQ=WEEKLY;INTERVAL={task.interval or 1}")
        elif task.recurrence == 'monthly':
            rrule.append(f"RRULE:FREQ=MONTHLY;INTERVAL={task.interval or 1}")
        # Could add end conditions based on task.endType here
        if rrule:
            event['recurrence'] = rrule

    # Check for color-coding based on assignees or room
    if task.assignees_rel:
        event['colorId'] = "9" # Blueberry blue
    else:
        event['colorId'] = "1" # Lavender

    try:
        if task.google_event_id:
            # Update existing
            updated_event = service.events().update(
                calendarId=calendar_id, 
                eventId=task.google_event_id, 
                body=event
            ).execute()
        else:
            # Create new
            created_event = service.events().insert(
                calendarId=calendar_id, 
                body=event
            ).execute()
            task.google_event_id = created_event['id']
            db.session.commit()
        return True
    except Exception as e:
        print(f"Error syncing task to GCal: {e}")
        # If event was deleted in GCal, creating it might fail or we might get 404 on update
        if "404" in str(e):
            task.google_event_id = None
            db.session.commit()
        return False

def sync_meal_to_gcal(user, meal, recipe=None):
    """Creates or updates a meal as a Google Calendar Event."""
    service = get_calendar_service(user)
    if not service:
        return False
        
    calendar_id = ensure_donespace_calendar(service)
    
    # Build description with context metadata
    desc = f"Meal: {meal.type.capitalize() if meal.type else 'Dinner'}\n"
    if meal.cook:
        desc += f"Cook: {meal.cook}\n"
    if recipe:
        desc += "\n--- Recipe Details ---\n"
        desc += f"Category: {recipe.category}\n"
        if recipe.time:
            desc += f"Time: {recipe.time}\n"
        if recipe.notes:
            desc += f"\nNotes:\n{recipe.notes}\n"
        
    event = {
        'summary': f"{meal.emoji or '🍽️'} {meal.title}",
        'description': desc,
        'extendedProperties': {
            'private': {
                'meal_id': str(meal.id),
                'type': 'meal'
            }
        },
        'colorId': "11", # Tomato red
        'transparency': 'transparent'
    }
    
    # Meals are usually all-day events on that date
    start_date = parse_date_to_iso(meal.date, all_day=True)
    end_dt = datetime.datetime.strptime(start_date['date'], "%Y-%m-%d") + datetime.timedelta(days=1)
    end_date = {'date': end_dt.strftime("%Y-%m-%d")}
    event['start'] = start_date
    event['end'] = end_date

    try:
        if meal.google_event_id:
            updated_event = service.events().update(
                calendarId=calendar_id, 
                eventId=meal.google_event_id, 
                body=event
            ).execute()
        else:
            created_event = service.events().insert(
                calendarId=calendar_id, 
                body=event
            ).execute()
            meal.google_event_id = created_event['id']
            db.session.commit()
        return True
    except Exception as e:
        print(f"Error syncing meal to GCal: {e}")
        if "404" in str(e):
            meal.google_event_id = None
            db.session.commit()
        return False

def delete_event(user, event_id):
    """Deletes an event from Google Calendar."""
    if not event_id:
        return True
        
    service = get_calendar_service(user)
    if not service:
        return False
        
    calendar_id = ensure_donespace_calendar(service)
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting event: {e}")
        return False
