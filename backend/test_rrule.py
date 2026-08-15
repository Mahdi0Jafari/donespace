from dateutil import rrule
from datetime import datetime
start = datetime.strptime("2026-08-12", "%Y-%m-%d")
occurrences = list(rrule.rrulestr("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE", dtstart=start).between(start, datetime.strptime("2026-09-12", "%Y-%m-%d"), inc=True))
print(occurrences)
