import logging
from apscheduler.schedulers.background import BackgroundScheduler
from backend.extensions import db
from backend.models import Task, User
from backend.utils.gcal import sync_task_to_gcal

logger = logging.getLogger(__name__)

def generate_future_rotating_events(app):
    """
    Runs periodically to ensure all rotating and shared tasks have 
    future events mapped in Google Calendar.
    """
    with app.app_context():
        logger.info("[GCal Scheduler] Starting generation of future GCal events for tasks...")
        
        tasks = Task.query.filter(Task.recurrence != 'none', Task.recurrence != None).all()
        
        count = 0
        for task in tasks:
            try:
                sync_task_to_gcal(None, task)
                count += 1
            except Exception as e:
                logger.error(f"[GCal Scheduler] Error syncing task {task.id}: {e}")
                
        logger.info(f"[GCal Scheduler] Finished generating future events for {count} tasks.")

def start_gcal_scheduler(app):
    """Initializes the background scheduler and starts the cron jobs."""
    scheduler = BackgroundScheduler()
    
    # Run the generation script every night at 2:00 AM
    scheduler.add_job(
        func=generate_future_rotating_events,
        args=[app],
        trigger="cron",
        hour=2,
        minute=0,
        id="gcal_generate_events",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("[GCal Scheduler] Background scheduler started.")
