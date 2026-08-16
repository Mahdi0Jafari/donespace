import unittest
from unittest.mock import patch, MagicMock
from app import app
from backend.extensions import db
from backend.models import User, Home, Meal, Recipe
from backend.utils.gcal import _resolve_cook_user, sync_meal_to_gcal, delete_meal_from_gcal

class TestMealGCalSync(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create Home and Users
        self.home = Home(name="Test Home", join_code="TEST12")
        db.session.add(self.home)
        db.session.commit()

        self.user_a = User(
            username="alice",
            email="alice@test.com",
            password_hash="pbkdf2:hash",
            display_name="Alice A",
            home_id=self.home.id,
            token="token_user_a",
            google_access_token="google_token_alice"
        )
        self.user_b = User(
            username="bob",
            email="bob@test.com",
            password_hash="pbkdf2:hash",
            display_name="Bob B",
            home_id=self.home.id,
            token="token_user_b",
            google_access_token="google_token_bob"
        )
        db.session.add_all([self.user_a, self.user_b])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_resolve_cook_user(self):
        meal1 = Meal(home_id=self.home.id, date="2026-08-16", title="Pasta", cook="bob")
        meal2 = Meal(home_id=self.home.id, date="2026-08-16", title="Salad", cook="Alice A")
        meal3 = Meal(home_id=self.home.id, date="2026-08-16", title="Pizza", cook="Anyone")
        meal4 = Meal(home_id=self.home.id, date="2026-08-16", title="Soup", cook="")

        self.assertEqual(_resolve_cook_user(meal1).id, self.user_b.id)
        self.assertEqual(_resolve_cook_user(meal2).id, self.user_a.id)
        self.assertIsNone(_resolve_cook_user(meal3))
        self.assertIsNone(_resolve_cook_user(meal4))

    @patch('backend.utils.gcal.get_calendar_service')
    @patch('backend.utils.gcal.ensure_donespace_calendar')
    def test_sync_meal_to_cook_calendar(self, mock_ensure_cal, mock_get_service):
        mock_service = MagicMock()
        mock_events = MagicMock()
        mock_service.events.return_value = mock_events
        mock_events.insert.return_value.execute.return_value = {'id': 'gcal_event_bob_123'}
        mock_get_service.return_value = mock_service
        mock_ensure_cal.return_value = ('cal_id_donespace', 'UTC')

        meal = Meal(home_id=self.home.id, date="2026-08-16", title="Steak Dinner", cook="bob", type="dinner")
        db.session.add(meal)
        db.session.commit()

        # Sync meal
        success = sync_meal_to_gcal(meal)
        self.assertTrue(success)
        
        # Verify get_calendar_service was called with User B (Bob, the cook) NOT User A
        mock_get_service.assert_called_with(self.user_b)
        
        # Verify database fields updated
        self.assertEqual(meal.google_event_id, 'gcal_event_bob_123')
        self.assertEqual(meal.gcal_user_id, self.user_b.id)

    @patch('backend.utils.gcal.delete_event')
    @patch('backend.utils.gcal.get_calendar_service')
    @patch('backend.utils.gcal.ensure_donespace_calendar')
    def test_reassign_cook_deletes_from_old_and_inserts_to_new(self, mock_ensure_cal, mock_get_service, mock_delete_event):
        mock_service = MagicMock()
        mock_events = MagicMock()
        mock_service.events.return_value = mock_events
        mock_events.insert.return_value.execute.return_value = {'id': 'gcal_event_alice_456'}
        mock_get_service.return_value = mock_service
        mock_ensure_cal.return_value = ('cal_id_donespace', 'UTC')

        # Meal was previously assigned to Bob
        meal = Meal(
            home_id=self.home.id,
            date="2026-08-16",
            title="Tacos",
            cook="alice",
            google_event_id="gcal_event_bob_123",
            gcal_user_id=self.user_b.id
        )
        db.session.add(meal)
        db.session.commit()

        # Sync with new cook (Alice)
        sync_meal_to_gcal(meal)

        # Ensure delete was called for old user (Bob)
        mock_delete_event.assert_called_with(self.user_b, "gcal_event_bob_123")
        
        # Ensure new event is registered to Alice
        self.assertEqual(meal.google_event_id, 'gcal_event_alice_456')
        self.assertEqual(meal.gcal_user_id, self.user_a.id)

    @patch('backend.utils.gcal.delete_event')
    def test_delete_meal_from_gcal(self, mock_delete_event):
        meal = Meal(
            home_id=self.home.id,
            date="2026-08-16",
            title="Tacos",
            cook="bob",
            google_event_id="gcal_event_bob_123",
            gcal_user_id=self.user_b.id
        )
        db.session.add(meal)
        db.session.commit()

        delete_meal_from_gcal(meal)
        mock_delete_event.assert_called_with(self.user_b, "gcal_event_bob_123")
        self.assertIsNone(meal.google_event_id)
        self.assertIsNone(meal.gcal_user_id)

    @patch('backend.utils.gcal.get_calendar_service')
    @patch('backend.utils.gcal.ensure_donespace_calendar')
    def test_api_save_meals_syncs_to_cook(self, mock_ensure_cal, mock_get_service):
        mock_service = MagicMock()
        mock_events = MagicMock()
        mock_service.events.return_value = mock_events
        mock_events.insert.return_value.execute.return_value = {'id': 'gcal_event_bob_789'}
        mock_get_service.return_value = mock_service
        mock_ensure_cal.return_value = ('cal_id_donespace', 'UTC')

        # Alice creates a meal assigned to Bob
        payload = {
            '2026-08-16': [
                {
                    'id': None,
                    'title': 'Burger Night',
                    'cook': 'bob',
                    'type': 'dinner',
                    'emoji': '🍔'
                }
            ]
        }

        response = self.client.post(
            '/api/meals',
            json=payload,
            headers={'Authorization': f'Bearer {self.user_a.token}'}
        )
        self.assertEqual(response.status_code, 200)

        # Check DB
        meal = Meal.query.filter_by(title='Burger Night').first()
        self.assertIsNotNone(meal)
        self.assertEqual(meal.cook, 'bob')
        self.assertEqual(meal.gcal_user_id, self.user_b.id)
        self.assertEqual(meal.google_event_id, 'gcal_event_bob_789')
        # Service was retrieved for Bob (the cook), NOT Alice
        mock_get_service.assert_called_with(self.user_b)

    @patch('backend.utils.gcal.get_calendar_service')
    @patch('backend.utils.gcal.ensure_donespace_calendar')
    def test_delete_task_api_and_gcal(self, mock_ensure_cal, mock_get_service):
        mock_service = MagicMock()
        mock_events = MagicMock()
        mock_service.events.return_value = mock_events
        mock_get_service.return_value = mock_service
        mock_ensure_cal.return_value = ('cal_id_donespace', 'UTC')

        from backend.models import Task, GCalEventMapping
        task = Task(home_id=self.home.id, title="Clean Kitchen")
        task.assignees_rel.append(self.user_a)
        db.session.add(task)
        db.session.flush()

        mapping = GCalEventMapping(
            task_id=task.id,
            user_id=self.user_a.id,
            google_event_id="gcal_clean_kitchen_event_1"
        )
        db.session.add(mapping)
        db.session.commit()

        # Delete task via API
        response = self.client.delete(
            f'/api/tasks/{task.id}',
            headers={'Authorization': f'Bearer {self.user_a.token}'}
        )
        self.assertEqual(response.status_code, 200)

        # Check DB task is gone
        self.assertIsNone(db.session.get(Task, task.id))
        self.assertEqual(GCalEventMapping.query.filter_by(task_id=task.id).count(), 0)

        # Check delete event was called in GCal
        mock_events.delete.assert_called_with(calendarId='cal_id_donespace', eventId='gcal_clean_kitchen_event_1')

if __name__ == '__main__':
    unittest.main()
