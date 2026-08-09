import os
from flask import Flask, request, jsonify, g, render_template, send_from_directory
from flask_cors import CORS
from backend.extensions import db
from backend.models import User

# Import Blueprints
from backend.routes.auth import auth_bp
from backend.routes.api import api_bp

# Serve static files from the frontend/static directory
app = Flask(__name__, template_folder='frontend/templates', static_folder='frontend/static')
CORS(app)

# Use absolute path for DB to avoid multiple databases in different working directories
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'database', 'donespace.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Initialize DB
with app.app_context():
    db_dir = os.path.join(BASE_DIR, 'database')
    os.makedirs(db_dir, exist_ok=True)
    db.create_all()

# --- Middleware ---

@app.before_request
def require_auth():
    # Allow CORS preflight
    if request.method == 'OPTIONS':
        return
    # Exempt auth routes
    if request.path in ['/api/auth/login', '/api/auth/register']:
        return
        
    # Exempt non-API routes (allow static files to load)
    if not request.path.startswith('/api/'):
        return

    # Check for SSE stream auth (from query params because EventSource doesn't support headers)
    if request.path == '/api/stream':
        token = request.args.get('token')
    else:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        token = auth_header.split(' ')[1]

    if not token:
        return jsonify({'error': 'Unauthorized'}), 401
        
    user = User.query.filter_by(token=token).first()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
        
    g.user = user

# --- Register Blueprints ---
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(api_bp, url_prefix='/api')

# --- Frontend Fallback Route ---
@app.route('/')
def index():
    return render_template('landing.html')

@app.route('/app')
def app_page():
    return render_template('index.html')

# --- SEO Routes ---
from flask import send_from_directory

@app.route('/robots.txt')
@app.route('/sitemap.xml')
@app.route('/llms.txt')
def static_from_root():
    return send_from_directory(app.static_folder, request.path[1:])

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/meals')
def meals_page():
    return render_template('meals.html')

@app.route('/logs')
def logs_page():
    return render_template('logs.html')

@app.route('/database/photos/<filename>')
def serve_photo(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'database', 'photos'), filename)

if __name__ == '__main__':
    app.run(port=3004, debug=True, threaded=True)
