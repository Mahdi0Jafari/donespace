# AGENTS.md

This file provides structured technical context for AI coding agents operating in this repository, adhering to the 2026 Agentic AI Foundation standards.

## 🏗 Project Structure
- `backend/models.py`: Contains all SQLAlchemy database models (User, Home, Task, Meal, etc.).
- `backend/routes/`: Contains Flask blueprints for `api` and `auth`.
- `frontend/static/`: Vanilla JavaScript and modular CSS. Do not use frontend frameworks (React/Vue/Svelte) or TailwindCSS unless explicitly requested.
- `app.py`: The entry point and middleware configuration for the Flask application.

## 🛠 Executable Commands
- **Install Dependencies:** `pip install -r backend/requirements.txt`
- **Run Application Local:** `python app.py` (Runs locally on port 3004)
- **Deploy:** Triggered automatically via GitHub Actions upon pushing to the `main` branch.

## 🚧 Boundaries & Constraints
- **Secrets:** Do not commit `.env` or hardcode any API keys or JWT secrets.
- **Database:** Do not commit `.db` or `.sqlite3` files. The SQLite database is generated automatically on the first run.
- **Port Conflicts:** The production docker container maps port 3004 to `8096`. Do not change this without updating the server's Nginx configuration.

## 📝 Code Style & Conventions
- Use explicit, descriptive variable names.
- Keep Flask routes thin; ensure all JSON API responses return standardized formats (e.g., `{'error': 'message'}` for failures).
- Maintain the strict separation of concerns between backend APIs and frontend presentation logic.
