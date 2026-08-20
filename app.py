import os
import markdown
import yaml
import secrets
from flask import Flask, request, jsonify, g, render_template, send_from_directory, redirect
from flask_cors import CORS
from backend.extensions import db
from backend.models import User

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Import Blueprints
from backend.routes.auth import auth_bp
from backend.routes.api import api_bp

# Serve static files from the frontend/static directory
app = Flask(__name__, template_folder='frontend/templates', static_folder='frontend/static')
CORS(app)

# Use absolute path for DB to avoid multiple databases in different working directories
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
db_dir = os.path.join(BASE_DIR, 'database')
os.makedirs(db_dir, exist_ok=True)
default_db_uri = 'sqlite:///' + os.path.join(db_dir, 'donespace.db')

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or default_db_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Secret key for Flask sessions (used during OAuth flow)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

db.init_app(app)

# Initialize DB
with app.app_context():
    db.create_all()
    try:
        with db.engine.connect() as conn:
            res = conn.execute(db.text("PRAGMA table_info(meal)")).fetchall()
            col_names = [r[1] for r in res]
            if col_names and 'gcal_user_id' not in col_names:
                conn.execute(db.text("ALTER TABLE meal ADD COLUMN gcal_user_id INTEGER REFERENCES user(id)"))
                conn.commit()
    except Exception as e:
        pass

# --- Background Schedulers ---
try:
    from backend.utils.gcal_scheduler import start_gcal_scheduler
    start_gcal_scheduler(app)
except Exception as e:
    print(f"Failed to start gcal scheduler: {e}")

# --- Middleware ---

@app.before_request
def handle_canonical_and_auth():
    # 1. Canonical host redirect (www to non-www 301 redirect)
    host = request.headers.get('Host', '')
    if host.startswith('www.'):
        new_url = request.url.replace('://www.', '://', 1)
        return redirect(new_url, code=301)

    # 2. Allow CORS preflight
    if request.method == 'OPTIONS':
        return
    # Exempt auth routes, static files, and public pages
    exempt_routes = ['/api/auth/login', '/api/auth/register', '/api/auth/check-email', '/login', '/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/about', '/manifest.webmanifest', '/manifest.json', '/sw.js', '/offline']
    if request.path in exempt_routes or request.path.startswith('/api/auth/invite/') or request.path.startswith('/api/auth/google/') or request.path.startswith('/static/') or request.path.startswith('/blog'):
        return
        
    # Check for SSE stream auth or URL token auth (e.g. from OAuth redirect)
    token = request.args.get('token')
    
    if not token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            token = request.cookies.get('authToken')

    if not token:
        if not request.path.startswith('/api/'):
            return redirect('/login')
        return jsonify({'error': 'Unauthorized'}), 401
        
    user = User.query.filter_by(token=token).first()
    if not user:
        if not request.path.startswith('/api/'):
            return redirect('/login')
        return jsonify({'error': 'Unauthorized'}), 401
        
    g.user = user

@app.after_request
def add_security_and_cache_headers(response):
    # Set Cache-Control for static assets
    if request.path.startswith('/static/'):
        if not response.headers.get('Cache-Control'):
            response.headers['Cache-Control'] = 'public, max-age=604800, stale-while-revalidate=86400'
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    return response

# --- Register Blueprints ---
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(api_bp, url_prefix='/api')

# --- Frontend Fallback Route ---
@app.route('/')
def index():
    token = request.cookies.get('authToken') or request.args.get('token')
    is_logged_in = False
    if token:
        user = User.query.filter_by(token=token).first()
        if user:
            is_logged_in = True
    posts = get_all_posts()
    return render_template('landing.html', is_logged_in=is_logged_in, recent_posts=posts[:3], footer_posts=posts[:5])

@app.route('/app')
def app_page():
    return render_template('index.html')

# --- Blog Routes ---
def get_all_posts():
    posts = []
    blog_dir = os.path.join(app.root_path, 'content', 'blog')
    if not os.path.exists(blog_dir):
        return posts
        
    for filename in os.listdir(blog_dir):
        if filename.endswith('.md'):
            filepath = os.path.join(blog_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    frontmatter = yaml.safe_load(parts[1])
                    body = parts[2]
                else:
                    frontmatter = {}
                    body = content
            else:
                frontmatter = {}
                body = content
                
            post_data = frontmatter if frontmatter else {}
            post_data['slug'] = filename[:-3]
            post_data['body'] = markdown.markdown(body, extensions=['extra', 'toc'])
            posts.append(post_data)
            
    posts.sort(key=lambda x: x.get('date', ''), reverse=True)
    return posts

@app.route('/blog')
def blog_index():
    posts = get_all_posts()
    return render_template('blog_index.html', posts=posts)

@app.route('/blog/<slug>')
def blog_post(slug):
    posts = get_all_posts()
    post = next((p for p in posts if p['slug'] == slug), None)
    if not post:
        from flask import abort
        abort(404)
    related_posts = [p for p in posts if p['slug'] != slug][:2]
    return render_template('blog_post.html', post=post, related_posts=related_posts)

# --- SEO Routes ---
from flask import send_from_directory, Response

@app.route('/robots.txt')
@app.route('/llms.txt')
def static_from_root():
    return send_from_directory(app.static_folder, request.path[1:])

# --- PWA Routes ---
@app.route('/sw.js')
def service_worker():
    response = send_from_directory(app.static_folder, 'sw.js')
    response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/manifest.webmanifest')
@app.route('/manifest.json')
def web_manifest():
    response = send_from_directory(app.static_folder, 'manifest.webmanifest')
    response.headers['Content-Type'] = 'application/manifest+json; charset=utf-8'
    response.headers['Cache-Control'] = 'public, max-age=86400'
    return response

@app.route('/offline')
def offline_page():
    return render_template('offline.html')

@app.route('/sitemap.xml')
def sitemap():
    posts = get_all_posts()
    xml_content = render_template('sitemap.xml', posts=posts)
    return Response(xml_content, mimetype='application/xml')

@app.route('/login')
def login_page():
    token = request.cookies.get('authToken') or request.args.get('token')
    if token:
        user = User.query.filter_by(token=token).first()
        if user:
            join_code = request.args.get('join')
            dest = f'/app{("?join=" + join_code) if join_code else ""}'
            return redirect(dest)
    return render_template('login.html')

@app.route('/about')
def about_page():
    return render_template('about.html')

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
