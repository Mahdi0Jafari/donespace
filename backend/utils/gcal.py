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

ICON_TO_EMOJI = {
    'local_dining': '🍽️',
    'restaurant': '🍳',
    'countertops': '🧼',
    'delete': '🗑️',
    'cleaning_services': '✨',
    'dry_cleaning': '🧺',
    'mop': '🧽',
    'kitchen': '🧊',
    'bed': '🛏️',
    'checkroom': '👕',
    'vacuum': '🧹',
    'laundry': '🧺',
    'shower': '🚿',
    'bathtub': '🛁',
    'wc': '🚽',
    'water_drop': '🪴',
    'yard': '🌿',
    'potted_plant': '🪴',
    'chair': '🛋️',
    'window': '🪟',
    'tools': '🔧',
    'build': '🛠️',
    'home': '🏠',
    'shopping_cart': '🛒',
    'shopping_bag': '🛍️',
    'fitness_center': '🏋️',
    'directions_run': '🏃',
    'pets': '🐾',
    'medication': '💊',
    'local_hospital': '🩺',
    'menu_book': '📚',
    'movie': '🍿',
    'celebration': '🎉',
    'cake': '🎂',
    'coffee': '☕',
    'local_cafe': '☕',
    'check_circle': '✅'
}

def get_emoji_for_task(icon, title):
    if icon and icon in ICON_TO_EMOJI:
        return ICON_TO_EMOJI[icon]
    lower = (title or '').lower()
    
    # Cleaning & Chores
    if any(w in lower for w in ['vacuum', 'جارو', 'sweep']):
        return '🧹'
    if any(w in lower for w in ['dish', 'dishes', 'ظرف', 'سینک']):
        return '🍽️'
    if any(w in lower for w in ['mop', 'طی', 'تی کشیدن']):
        return '🧽'
    if any(w in lower for w in ['dust', 'گردگیری', 'دستمال']):
        return '✨'
    if any(w in lower for w in ['flower', 'water', 'plant', 'garden', 'گل', 'گیاه', 'گلدان', 'باغچه', 'آبیاری']):
        return '🪴'
    if any(w in lower for w in ['bed', 'تخت', 'رختخواب', 'ملحفه']):
        return '🛏️'
    if any(w in lower for w in ['laundry', 'clothes', 'لباس', 'اتو', 'شستشو']):
        return '🧺'
    if any(w in lower for w in ['trash', 'garbage', 'waste', 'زباله', 'آشغال']):
        return '🗑️'
    if any(w in lower for w in ['bath', 'shower', 'wc', 'toilet', 'حمام', 'دستشویی', 'توالت']):
        return '🛁'
    if any(w in lower for w in ['window', 'glass', 'mirror', 'پنجره', 'شیشه', 'آینه']):
        return '🪟'
    
    # Food & Drink
    if any(w in lower for w in ['breakfast', 'صبحانه', 'املت', 'پنکیک']):
        return '🥞'
    if any(w in lower for w in ['lunch', 'dinner', 'cook', 'recipe', 'meal', 'غذا', 'آشپزی', 'پختن', 'شام', 'ناهار']):
        return '🍳'
    if any(w in lower for w in ['coffee', 'tea', 'قهوه', 'چای']):
        return '☕'
    if any(w in lower for w in ['grocery', 'shopping', 'supermarket', 'خرید', 'سوپرمارکت', 'میوه']):
        return '🛒'
    
    # Health, Fitness, Pets & Lifestyle
    if any(w in lower for w in ['gym', 'workout', 'fitness', 'ورزش', 'باشگاه', 'بدنسازی']):
        return '🏋️'
    if any(w in lower for w in ['run', 'walk', 'دویدن', 'پیاده روی']):
        return '🏃'
    if any(w in lower for w in ['yoga', 'stretch', 'یوگا']):
        return '🧘'
    if any(w in lower for w in ['pet', 'dog', 'cat', 'سگ', 'گربه', 'حیوان']):
        return '🐾'
    if any(w in lower for w in ['doctor', 'dentist', 'med', 'pill', 'دارو', 'دکتر', 'دندان', 'قرص']):
        return '💊'
    if any(w in lower for w in ['book', 'read', 'کتاب', 'مطالعه']):
        return '📚'
    if any(w in lower for w in ['movie', 'cinema', 'film', 'فیلم', 'سینما']):
        return '🍿'
    if any(w in lower for w in ['birthday', 'party', 'تولد', 'جشن', 'مهمانی']):
        return '🎉'
    if any(w in lower for w in ['fix', 'repair', 'tools', 'تعمیر', 'ابزار', 'سرویس']):
        return '🔧'

    return '📋'

def _enhance_title_for_flair(title):
    """
    Intelligently appends exact Google Calendar flair trigger phrases (without regex-breaking brackets)
    to activate native mobile illustrations seamlessly.
    """
    lower_title = title.lower()
    
    # If the title already naturally contains one of the official triggers, preserve as-is
    exact_triggers = [
        'clean house', 'clean the house', 'clean the apartment', 'vacuum clean', 'tidy up',
        'cook dinner', 'cook lunch', 'cook meal', 'cooking',
        'breakfast', 'lunch', 'dinner', 'brunch', 'bbq', 'barbecue', 'coffee', 'tea',
        'laundry', 'groceries', 'supermarket', 'diy', 'electrician',
        'dentist', 'doctor', 'haircut', 'massage',
        'running', 'cycling', 'swimming', 'yoga', 'gym', 'crossfit',
        'cinema', 'movie', 'book club', 'camping', 'birthday', 'board games'
    ]
    if any(phrase in lower_title for phrase in exact_triggers):
        return title

    # Cleaning & Housework
    if any(word in lower_title for word in ['wash', 'clean', 'wipe', 'dust', 'vacuum', 'mop', 'trash', 'tidy', 'sweep', 'organize', 'disinfect', 'bed', 'fridge', 'defrost', 'sink', 'mirror', 'window', 'flower', 'water', 'plant', 'شستن', 'شستشو', 'تمیز', 'جارو', 'طی کشیدن', 'نظافت', 'زباله', 'آشغال', 'گردگیری', 'مرتب', 'سینک', 'ظرفشویی', 'تخت', 'رختخواب', 'یخچال', 'فریزر', 'برفک', 'آینه', 'پنجره', 'گلدان', 'گیاه', 'گل']):
        return f"{title} • clean house"
        
    if any(word in lower_title for word in ['laundry', 'clothes', 'sheets', 'towel', 'ironing', 'dry cleaning', 'لباسشویی', 'لباس', 'ملحفه', 'حوله', 'اتو']):
        return f"{title} • laundry"
        
    # Food & Drinks
    if any(word in lower_title for word in ['cook', 'bake', 'meal prep', 'recipe', 'پختن', 'آشپزی', 'غذا']):
        return f"{title} • cooking"
        
    if any(word in lower_title for word in ['grocery', 'groceries', 'supermarket', 'خرید', 'سوپرمارکت', 'تره بار', 'میوه']):
        return f"{title} • groceries"
        
    if any(word in lower_title for word in ['coffee', 'tea', 'cafe', 'قهوه', 'چای', 'کافه']):
        return f"{title} • coffee"
        
    if any(word in lower_title for word in ['صبحانه', 'املت', 'پنکیک']):
        return f"{title} • breakfast"
        
    if any(word in lower_title for word in ['ناهار']):
        return f"{title} • lunch"
        
    if any(word in lower_title for word in ['شام']):
        return f"{title} • dinner"

    # Maintenance & Technical
    if any(word in lower_title for word in ['electrician', 'lamp', 'wiring', 'برقکار', 'لامپ', 'برق', 'سیم کشی']):
        return f"{title} • electrician"

    if any(word in lower_title for word in ['fix', 'repair', 'maintenance', 'tools', 'تعمیر', 'درست کردن', 'سرویس', 'ابزار', 'فنی']):
        return f"{title} • diy"

    # Health & Fitness
    if any(word in lower_title for word in ['dentist', 'dental', 'دندان', 'دندانپزشک', 'مسواک']):
        return f"{title} • dentist"

    if any(word in lower_title for word in ['doctor', 'med', 'pill', 'دکتر', 'پزشک', 'دارو', 'قرص', 'چکاپ']):
        return f"{title} • doctor"

    if any(word in lower_title for word in ['gym', 'workout', 'fitness', 'crossfit', 'ورزش', 'باشگاه', 'بدنسازی']):
        return f"{title} • gym"

    if any(word in lower_title for word in ['run', 'jog', 'walk', 'دویدن', 'پیاده روی']):
        return f"{title} • running"

    if any(word in lower_title for word in ['yoga', 'یوگا']):
        return f"{title} • yoga"

    if any(word in lower_title for word in ['bike', 'cycling', 'دوچرخه']):
        return f"{title} • cycling"

    # Entertainment & Social
    if any(word in lower_title for word in ['movie', 'cinema', 'film', 'فیلم', 'سینما']):
        return f"{title} • cinema"

    if any(word in lower_title for word in ['book', 'read', 'کتاب', 'مطالعه']):
        return f"{title} • book club"

    if any(word in lower_title for word in ['birthday', 'party', 'تولد', 'جشن', 'مهمانی']):
        return f"{title} • birthday"

    return title

def sync_task_to_gcal(user, task):
    """
    Syncs a task to Google Calendar based on assignees and rotation logic using Upserts.
    """
    assignees = task.assignees_rel
    if not assignees:
        return True

    emoji = get_emoji_for_task(task.icon, task.title)
    full_title = f"{emoji} {task.title}" if emoji not in task.title else task.title
    
    base_event = {
        'summary': _enhance_title_for_flair(full_title),
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

def delete_task_from_gcal(task):
    """Deletes all Google Calendar events associated with this task across all assignees."""
    mappings = GCalEventMapping.query.filter_by(task_id=task.id).all()
    for mapping in mappings:
        user = db.session.get(User, mapping.user_id)
        if user:
            try:
                service = get_calendar_service(user)
                if service:
                    calendar_id, _ = ensure_donespace_calendar(service)
                    service.events().delete(calendarId=calendar_id, eventId=mapping.google_event_id).execute()
            except Exception as e:
                pass # Ignore if already deleted in GCal
        db.session.delete(mapping)
    
    if task.google_event_id:
        # Legacy cleanup
        home_members = User.query.filter_by(home_id=task.home_id).all()
        for member in home_members:
            if member.google_access_token:
                try:
                    service = get_calendar_service(member)
                    if service:
                        calendar_id, _ = ensure_donespace_calendar(service)
                        service.events().delete(calendarId=calendar_id, eventId=task.google_event_id).execute()
                        break
                except Exception:
                    pass
        task.google_event_id = None
    db.session.commit()
    return True

def _resolve_cook_user(meal, home_members=None):
    """Finds the User object corresponding to meal.cook in the household."""
    if not meal.cook or meal.cook in ('Anyone', 'anyone', ''):
        return None
    if home_members is None:
        home_members = User.query.filter_by(home_id=meal.home_id).all()
    for member in home_members:
        if member.username == meal.cook or (member.display_name and member.display_name == meal.cook):
            return member
    return None

def sync_meal_to_gcal(meal, home_members=None, recipe=None):
    """
    Syncs a meal to Google Calendar of the assigned cook (not the creator/editor).
    Handles reassignments, additions, and cook changes seamlessly.
    """
    cook_user = _resolve_cook_user(meal, home_members)
    
    # 1. If no cook is assigned (or cook is 'Anyone'):
    if not cook_user:
        # If there was a previous GCal event for this meal, delete it from the old user's calendar
        if meal.google_event_id and meal.gcal_user_id:
            old_user = db.session.get(User, meal.gcal_user_id)
            if old_user:
                delete_event(old_user, meal.google_event_id)
            meal.google_event_id = None
            meal.gcal_user_id = None
            db.session.commit()
        return True

    # 2. Cook user was found. Check if the cook has Google Calendar connected.
    service = get_calendar_service(cook_user)
    if not service:
        # Cook does not have Google Calendar connected.
        # Clean up any old event on someone else's calendar if reassigned.
        if meal.google_event_id and meal.gcal_user_id and meal.gcal_user_id != cook_user.id:
            old_user = db.session.get(User, meal.gcal_user_id)
            if old_user:
                delete_event(old_user, meal.google_event_id)
            meal.google_event_id = None
            meal.gcal_user_id = None
            db.session.commit()
        return False

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
        'summary': _enhance_title_for_flair(f"{meal.emoji or '🍽️'} {meal.title}"),
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
        # If cook changed (was previously synced to a different user), delete from old user
        if meal.google_event_id and meal.gcal_user_id and meal.gcal_user_id != cook_user.id:
            old_user = db.session.get(User, meal.gcal_user_id)
            if old_user:
                delete_event(old_user, meal.google_event_id)
            meal.google_event_id = None
            meal.gcal_user_id = None

        if meal.google_event_id and meal.gcal_user_id == cook_user.id:
            service.events().update(calendarId=calendar_id, eventId=meal.google_event_id, body=event).execute()
        else:
            created_event = service.events().insert(calendarId=calendar_id, body=event).execute()
            meal.google_event_id = created_event['id']
            meal.gcal_user_id = cook_user.id
            
        db.session.commit()
        return True
    except Exception as e:
        logger.error(f"[GCal] Failed to sync meal to {cook_user.username}: {e}")
        if "404" in str(e):
            meal.google_event_id = None
            meal.gcal_user_id = None
            db.session.commit()
        return False

def delete_meal_from_gcal(meal, home_members=None):
    """Deletes a meal's Google Calendar event from the assigned cook's calendar."""
    if not meal.google_event_id:
        return True
        
    target_user = None
    if getattr(meal, 'gcal_user_id', None):
        target_user = db.session.get(User, meal.gcal_user_id)
    if not target_user:
        target_user = _resolve_cook_user(meal, home_members)
        
    if target_user:
        res = delete_event(target_user, meal.google_event_id)
        meal.google_event_id = None
        meal.gcal_user_id = None
        return res
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
