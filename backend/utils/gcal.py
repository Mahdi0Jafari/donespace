import os
import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from backend.extensions import db
from backend.models import User, GCalEventMapping

# The scopes required for Calendar and Profile
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

import logging
logger = logging.getLogger(__name__)

# Mapping UI colour hex strings to Google Calendar colour IDs
UI_COLOR_TO_GCAL = {
    "purple": "3", "pink": "4", "yellow": "5", "orange": "6",
    "cyan": "7", "grey": "8", "blue": "9", "green": "10", "red": "11"
}

def get_credentials(user):
    """Rebuilds credentials from the user object and refreshes if needed."""
    if not user.google_access_token:
        return None
        
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    
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
            user.google_access_token = creds.token
            if creds.expiry:
                user.google_token_expiry = creds.expiry
            db.session.commit()
        except Exception as e:
            logger.error(f"[GCal] Failed to refresh Google credentials for {user.email}: {e}")
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
        logger.error(f"[GCal] Failed to build calendar service for {user.email}: {e}")
        return None

def ensure_donespace_calendar(service):
    try:
        page_token = None
        while True:
            calendar_list = service.calendarList().list(pageToken=page_token).execute()
            for calendar_list_entry in calendar_list['items']:
                if calendar_list_entry['summary'] == 'DoneSpace':
                    return calendar_list_entry['id'], calendar_list_entry.get('timeZone', 'UTC')
            page_token = calendar_list.get('nextPageToken')
            if not page_token:
                break
        
        primary = service.calendars().get(calendarId='primary').execute()
        tz = primary.get('timeZone', 'UTC')
        
        calendar = {
            'summary': 'DoneSpace',
            'timeZone': tz,
            'description': 'Tasks and Meals from DoneSpace.ir'
        }
        created_calendar = service.calendars().insert(body=calendar).execute()
        return created_calendar['id'], tz
    except Exception as e:
        logger.error(f"[GCal] Failed to ensure calendar: {e}")
        return 'primary', 'UTC'

from zoneinfo import ZoneInfo

def parse_date_to_iso(date_str, time_str=None, all_day=True, tz_name='UTC'):
    if not date_str:
        date_str = datetime.datetime.now().strftime('%Y-%m-%d')
    if all_day:
        return {'date': date_str}
    
    if not time_str:
        time_str = "09:00"
        
    try:
        tz = ZoneInfo(tz_name)
        dt = datetime.datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        dt = dt.replace(tzinfo=tz)
        iso_str = dt.isoformat()
    except Exception:
        iso_str = f"{date_str}T{time_str}:00"
        
    return {'dateTime': iso_str, 'timeZone': tz_name}

def _weekday_code(day_index):
    # JS Date.getDay() format: 0=Sunday, 1=Monday...
    mapping = {0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA'}
    return mapping.get(day_index % 7, 'SU')

def _build_rrule(task):
    if not task.recurrence or task.recurrence == 'none':
        return []
    rrule = []
    freq = task.recurrence.upper()
    base = f"RRULE:FREQ={freq};INTERVAL={task.interval or 1}"
    if getattr(task, 'customDays', None):
        days = task.customDays
        if isinstance(days, str):
            try:
                import json
                days = json.loads(days)
            except Exception:
                days = []
        if isinstance(days, list) and len(days) > 0:
            days_codes = [_weekday_code(d) for d in days]
            base += f";BYDAY={','.join(days_codes)}"
    rrule.append(base)
    if task.endType == 'date' and task.endDate:
        rrule[0] += f";UNTIL={task.endDate.replace('-', '')}T235959Z"
    elif task.endType == 'occurrences' and task.endOccurrences:
        rrule[0] += f";COUNT={task.endOccurrences}"
    return rrule

def _enhance_title_for_flair(title):
    """
    Intelligently appends Google Calendar keywords as hidden tags to trigger illustrations
    without relying on the exact wording of the user. Supports both English and Persian keywords.
    Focused entirely on Home Management and Chores.
    """
    lower_title = title.lower()
    
    # Check if title already naturally triggers a known popular flair to avoid redundancy
    if any(word in lower_title for word in ['lunch', 'dinner', 'breakfast', 'bbq']):
        return title

    # Comprehensive mapping for Home Management platform
    flair_mappings = {
        # Kitchen & Meals
        '[Cooking]': ['cook', 'bake', 'meal prep', 'recipe', 'پختن', 'آشپزی', 'غذا'],
        '[Lunch]': ['ناهار'],
        '[Dinner]': ['شام'],
        '[Breakfast]': ['صبحانه', 'املت'],
        '[Groceries]': ['grocery', 'groceries', 'supermarket', 'خرید', 'سوپرمارکت', 'تره بار', 'میوه'],
        
        # General Cleaning & Chores
        '[Cleaning]': ['wash', 'clean', 'wipe', 'dust', 'vacuum', 'mop', 'trash', 'tidy', 'sweep', 'organize', 'disinfect', 'bed', 'fridge', 'defrost', 'شستن', 'شستشو', 'تمیز', 'جارو', 'طی کشیدن', 'نظافت', 'زباله', 'آشغال', 'گردگیری', 'مرتب', 'سینک', 'ظرفشویی', 'تخت', 'رختخواب', 'یخچال', 'فریزر', 'برفک'],
        
        # Laundry (Triggers Dry Cleaning illustration)
        '[Dry Cleaning]': ['laundry', 'clothes', 'sheets', 'towel', 'ironing', 'dry cleaning', 'لباسشویی', 'لباس', 'ملحفه', 'حوله', 'اتو'],
        
        # Home Maintenance & Repairs
        '[DIY]': ['fix', 'repair', 'maintenance', 'tools', 'تعمیر', 'درست کردن', 'سرویس', 'ابزار', 'فنی'],
        '[Electrician]': ['electrician', 'lamp', 'wiring', 'برقکار', 'لامپ', 'برق', 'سیم کشی'],
        
        # Bills & Admin (often triggers Finances/Bank illustrations)
        '[Finances]': ['bill', 'rent', 'mortgage', 'قبض', 'اجاره', 'قسط', 'وام', 'شارژ'],
        
        # Pets
        '[Vet]': ['pet', 'dog', 'cat', 'vet', 'veterinarian', 'حیوان', 'سگ', 'گربه', 'دامپزشک']
    }
    
    for flair_keyword, trigger_words in flair_mappings.items():
        if any(word in lower_title for word in trigger_words):
            return f"{title} {flair_keyword}"
            
    return title

def sync_task_to_gcal(user, task):
    """
    Syncs a task to Google Calendar based on assignees and rotation logic using Upserts.
    """
    assignees = task.assignees_rel
    if not assignees:
        return True

    icon_prefix = f"{task.icon} " if (task.icon and len(task.icon) <= 4 and "_" not in task.icon) else ""
    
    base_event = {
        'summary': _enhance_title_for_flair(f"{icon_prefix}{task.title}"),
        'description': task.description or "DoneSpace Task",
        'extendedProperties': {
            'private': {
                'task_id': str(task.id),
                'type': 'task'
            }
        },
        'reminders': {
            'useDefault': False,
            'overrides': [{'method': 'popup', 'minutes': 30}],
        },
        'transparency': 'transparent',
        'colorId': UI_COLOR_TO_GCAL.get(task.color, "3") if getattr(task, "color", None) else "3"
    }

    def build_time_dict(date_str, tz_name):
        ev = {}
        if task.allDay:
            start_date = parse_date_to_iso(date_str, all_day=True, tz_name=tz_name)
            end_dt = datetime.datetime.strptime(start_date['date'], "%Y-%m-%d") + datetime.timedelta(days=1)
            ev['start'] = start_date
            ev['end'] = {'date': end_dt.strftime("%Y-%m-%d")}
        else:
            start_time = parse_date_to_iso(date_str, task.time, all_day=False, tz_name=tz_name)
            ev['start'] = start_time
            try:
                start_dt = datetime.datetime.fromisoformat(start_time['dateTime'])
                end_dt = start_dt + datetime.timedelta(hours=1)
                ev['end'] = {'dateTime': end_dt.isoformat(), 'timeZone': start_time['timeZone']}
            except Exception:
                ev['end'] = start_time
        return ev

    # We will track which mapping IDs are validated/updated during this sync
    validated_mapping_ids = []

    # 1. SHARED TASK (NON-ROTATING) OR SINGLE ASSIGNEE
    if not task.rotate or len(assignees) <= 1:
        for assignee in assignees:
            service = get_calendar_service(assignee)
            if not service: continue
            
            calendar_id, tz_name = ensure_donespace_calendar(service)
            event = base_event.copy()
            event.update(build_time_dict(task.startDate or datetime.datetime.now().strftime('%Y-%m-%d'), tz_name))
            
            rrule = _build_rrule(task)
            if rrule:
                event['recurrence'] = rrule
                
            # Check if this assignee already has a mapping for this task (non-rotating doesn't use occurrence_date)
            mapping = GCalEventMapping.query.filter_by(task_id=task.id, user_id=assignee.id, occurrence_date=None).first()
            
            try:
                if mapping:
                    # Update
                    service.events().update(calendarId=calendar_id, eventId=mapping.google_event_id, body=event).execute()
                else:
                    # Insert
                    created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
                    mapping = GCalEventMapping(task_id=task.id, user_id=assignee.id, google_event_id=created_event['id'], occurrence_date=None)
                    db.session.add(mapping)
                    db.session.flush() # get ID
                
                validated_mapping_ids.append(mapping.id)
            except Exception as e:
                logger.error(f"[GCal] Failed to sync recurring event for {assignee.username}: {e}")
                if "404" in str(e) and mapping:
                    db.session.delete(mapping)
        db.session.commit()

    # 2. ROTATING TASK
    else:
        from dateutil import rrule
        
        start_date_str = task.startDate or datetime.datetime.now().strftime('%Y-%m-%d')
        start_dt = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
        
        if not task.recurrence or task.recurrence == 'none':
            # Not recurring? Can't rotate. Clean up mappings.
            pass
        else:
            rrule_list = _build_rrule(task)
            if rrule_list:
                rrule_str = rrule_list[0]
                
                try:
                    r = rrule.rrulestr(rrule_str, dtstart=start_dt)
                    end_limit = start_dt + datetime.timedelta(days=90) # Next 90 days
                    occurrences = list(r.between(start_dt, end_limit, inc=True))
                    occurrences = occurrences[:30] # Max 30 occurrences
                    
                    for index, occ_dt in enumerate(occurrences):
                        occ_date_str = occ_dt.strftime('%Y-%m-%d')
                        turn_index = index % len(assignees)
                        assignee = assignees[turn_index]
                        
                        service = get_calendar_service(assignee)
                        if not service: continue
                        
                        calendar_id, tz_name = ensure_donespace_calendar(service)
                        event = base_event.copy()
                        event.update(build_time_dict(occ_date_str, tz_name))
                        
                        # Search for existing rotating mapping for THIS exact occurrence date and user
                        mapping = GCalEventMapping.query.filter_by(task_id=task.id, occurrence_date=occ_date_str).first()
                        
                        try:
                            if mapping:
                                if mapping.user_id != assignee.id:
                                    # The turn changed (e.g. assignee added/removed), we need to move it to the new user.
                                    # Delete from old user
                                    old_user = db.session.get(User, mapping.user_id)
                                    if old_user:
                                        old_service = get_calendar_service(old_user)
                                        if old_service:
                                            old_cal, _ = ensure_donespace_calendar(old_service)
                                            try:
                                                old_service.events().delete(calendarId=old_cal, eventId=mapping.google_event_id).execute()
                                            except Exception: pass
                                    
                                    # Insert for new user
                                    created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
                                    mapping.user_id = assignee.id
                                    mapping.google_event_id = created_event['id']
                                else:
                                    # Update for same user
                                    service.events().update(calendarId=calendar_id, eventId=mapping.google_event_id, body=event).execute()
                            else:
                                # Insert new
                                created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
                                mapping = GCalEventMapping(
                                    task_id=task.id, 
                                    user_id=assignee.id, 
                                    google_event_id=created_event['id'],
                                    occurrence_date=occ_date_str
                                )
                                db.session.add(mapping)
                                
                            db.session.flush()
                            validated_mapping_ids.append(mapping.id)
                        except Exception as e:
                            logger.error(f"[GCal] Failed to sync rotating event for {assignee.username} on {occ_date_str}: {e}")
                            if "404" in str(e) and mapping:
                                db.session.delete(mapping)
                    db.session.commit()
                except Exception as e:
                    logger.error(f"[GCal] Failed to parse/generate occurrences for task '{task.title}': {e}")

    # 3. CLEAN UP ORPHANED MAPPINGS
    # Any mappings for this task that were NOT validated above should be deleted from Google Calendar and the DB.
    # This cleans up instances where an assignee is removed, or a task stops rotating, or the rotation dates shift.
    orphaned_mappings = GCalEventMapping.query.filter_by(task_id=task.id).filter(GCalEventMapping.id.notin_(validated_mapping_ids)).all()
    for mapping in orphaned_mappings:
        user = db.session.get(User, mapping.user_id)
        if user:
            try:
                service = get_calendar_service(user)
                if service:
                    calendar_id, _ = ensure_donespace_calendar(service)
                    service.events().delete(calendarId=calendar_id, eventId=mapping.google_event_id).execute()
            except Exception as e:
                pass # Ignore if already deleted
        db.session.delete(mapping)
        
    # Remove legacy ID
    if task.google_event_id:
        task.google_event_id = None
        
    db.session.commit()
    return True

def sync_meal_to_gcal(user, meal, recipe=None):
    service = get_calendar_service(user)
    if not service: return False
        
    calendar_id, tz_name = ensure_donespace_calendar(service)
    
    desc = f"Meal: {meal.type.capitalize() if meal.type else 'Dinner'}\n"
    if meal.cook:
        desc += f"Cook: {meal.cook}\n"
    if recipe:
        desc += "\n--- Recipe Details ---\n"
        desc += f"Category: {recipe.category}\n"
        if recipe.time: desc += f"Time: {recipe.time}\n"
        if recipe.notes: desc += f"\nNotes:\n{recipe.notes}\n"
        
    event = {
        'summary': f"{meal.emoji or '🍽️'} {meal.title}",
        'description': desc,
        'extendedProperties': {'private': {'meal_id': str(meal.id), 'type': 'meal'}},
        'colorId': "11",
        'transparency': 'transparent'
    }
    
    meal_times = {'breakfast': ('08:00', '09:00'), 'lunch': ('13:00', '14:00'), 'snack': ('16:00', '16:30'), 'dinner': ('19:00', '20:00')}
    m_type = (meal.type or 'dinner').lower()
    start_time_str, end_time_str = meal_times.get(m_type, ('19:00', '20:00'))
    
    event['start'] = parse_date_to_iso(meal.date, time_str=start_time_str, all_day=False, tz_name=tz_name)
    event['end'] = parse_date_to_iso(meal.date, time_str=end_time_str, all_day=False, tz_name=tz_name)

    try:
        if meal.google_event_id:
            service.events().update(calendarId=calendar_id, eventId=meal.google_event_id, body=event).execute()
        else:
            created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
            meal.google_event_id = created_event['id']
            db.session.commit()
        return True
    except Exception as e:
        if "404" in str(e):
            meal.google_event_id = None
            db.session.commit()
        return False

def delete_event(user, event_id):
    if not event_id: return True
    service = get_calendar_service(user)
    if not service: return False
        
    calendar_id, _ = ensure_donespace_calendar(service)
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
    except Exception as e:
        return False
