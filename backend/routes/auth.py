from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
import time
import secrets
import string
from backend.extensions import db
from backend.models import User, Home, UserHome

import os
import base64
import re
from io import BytesIO
from PIL import Image

import os
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import datetime

# Path to the JSON secret provided by user
CLIENT_SECRETS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "credentials.json")
# Scopes for Google OAuth
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]

auth_bp = Blueprint('auth', __name__)

def generate_join_code():
    while True:
        code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        if not db.session.get(Home, code):
            return code

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    display_name = data.get('display_name') or username
    email = data.get('email')
    password = data.get('password')
    join_code = data.get('join_code')
    home_name = data.get('home_name')
    avatar_data = data.get('avatar')
    
    if not username or not email or not password:
        return jsonify({'error': 'Missing required fields (username, email, password)'}), 400
        
    if len(username) > 20:
        return jsonify({'error': 'Username must be 20 characters or less'}), 400
        
    if len(display_name) > 50:
        return jsonify({'error': 'Display name must be 50 characters or less'}), 400
        
    if len(email) > 100:
        return jsonify({'error': 'Email is too long'}), 400
        
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return jsonify({'error': 'Username must contain only English letters, numbers, and underscores'}), 400
        
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({'error': 'Invalid email format'}), 400
        
    if not password.isascii():
        return jsonify({'error': 'Password must contain only English/ASCII characters'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 400
        
    home = None
    if join_code:
        home = Home.query.filter_by(join_code=join_code).first()
        if not home:
            return jsonify({'error': 'Invalid join code'}), 400
    elif home_name:
        home = Home(
            name=home_name,
            join_code=generate_join_code()
        )
        db.session.add(home)
        db.session.flush()
    
    avatar_url = avatar_data
    if avatar_data and avatar_data.startswith('data:image'):
        try:
            header, encoded = avatar_data.split(",", 1)
            
            # Extract and validate MIME type from data URL header
            # e.g. "data:image/jpeg;base64" → "image/jpeg"
            mime_type = header.split(";")[0].replace("data:", "").strip().lower()
            ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
            if mime_type not in ALLOWED_MIME_TYPES:
                # Reject SVG, BMP, TIFF, HEIC, etc.
                avatar_url = None
                print(f"Rejected avatar with unsupported MIME type: {mime_type}")
            else:
                image_bytes = base64.b64decode(encoded)
                img = Image.open(BytesIO(image_bytes))
                
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    
                img.thumbnail((256, 256))
                
                upload_dir = os.path.join(os.path.dirname(__file__), '../../database/photos')
                os.makedirs(upload_dir, exist_ok=True)
                
                filename = f"{username}_{int(time.time())}.webp"
                filepath = os.path.join(upload_dir, filename)
                
                img.save(filepath, "WEBP", quality=80)
                avatar_url = f"/database/photos/{filename}"
        except Exception as e:
            print(f"Error processing avatar: {e}")
            avatar_url = None
            
    user = User(
        username=username,
        display_name=display_name,
        email=email,
        avatar=avatar_url,
        password_hash=generate_password_hash(password),
        home_id=home.id if home else None, # their current active home
        token=secrets.token_hex(32)
    )
    db.session.add(user)
    db.session.flush()
    
    if home:
        # Create the UserHome association if a home was created/joined
        role = 'owner' if home_name else 'member'
        user_home = UserHome(user_id=user.id, home_id=home.id, role=role)
        db.session.add(user_home)
    
    db.session.commit()
    
    return jsonify({
        'token': user.token,
        'user': user.to_dict(),
        'home': {'name': home.name, 'join_code': home.join_code} if home else None
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email') # Can be email or username for backward compatibility
    password = data.get('password')
    
    # Try finding by email first, then username
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User.query.filter_by(username=email).first()
        
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401
        
    user.token = secrets.token_hex(32) # Generate new token on login
    db.session.commit()
    
    home = db.session.get(Home, user.home_id) if user.home_id else None
    return jsonify({
        'token': user.token,
        'user': user.to_dict(),
        'home': {'name': home.name, 'join_code': home.join_code} if home else None
    })

@auth_bp.route('/me', methods=['GET'])
def me():
    if not hasattr(g, 'user'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    active_home = db.session.get(Home, g.user.home_id) if g.user.home_id else None
    
    # Get all users in active home for assignees
    member_list = []
    if active_home:
        # We find users by looking at UserHome
        user_homes_active = UserHome.query.filter_by(home_id=active_home.id).all()
        for uh in user_homes_active:
            u = db.session.get(User, uh.user_id)
            if u:
                member_list.append(u.to_dict())
    
    # Get all homes the user belongs to
    user_homes = UserHome.query.filter_by(user_id=g.user.id).all()
    homes_list = []
    for uh in user_homes:
        h = db.session.get(Home, uh.home_id)
        if h:
            homes_list.append({
                'id': h.id,
                'name': h.name,
                'role': uh.role
            })
            
    # Fallback for legacy data or if user has no home
    if not user_homes and g.user.home_id:
        active_home = db.session.get(Home, g.user.home_id)
        if active_home:
            homes_list.append({'id': active_home.id, 'name': active_home.name, 'role': 'member'})
            # auto-heal
            db.session.add(UserHome(user_id=g.user.id, home_id=active_home.id, role='owner'))
            db.session.commit()

    return jsonify({
        'user': g.user.to_dict(),
        'home': {'name': active_home.name, 'id': active_home.id, 'join_code': active_home.join_code, 'members': member_list} if active_home else None,
        'homes': homes_list
    })

@auth_bp.route('/switch_home', methods=['POST'])
def switch_home():
    if not hasattr(g, 'user'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    new_home_id = data.get('home_id')
    
    # Verify user belongs to this home
    user_home = UserHome.query.filter_by(user_id=g.user.id, home_id=new_home_id).first()
    if not user_home:
        return jsonify({'error': 'You do not belong to this home'}), 403
        
    g.user.home_id = new_home_id
    db.session.commit()
    return jsonify({'success': True})
    
@auth_bp.route('/join_home', methods=['POST'])
def join_home():
    if not hasattr(g, 'user'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    join_code = data.get('join_code')
    
    home = Home.query.filter_by(join_code=join_code).first()
    if not home:
        return jsonify({'error': 'Invalid join code'}), 400
        
    # Check if already joined
    existing = UserHome.query.filter_by(user_id=g.user.id, home_id=home.id).first()
    if existing:
        return jsonify({'error': 'Already a member of this home'}), 400
        
    new_link = UserHome(user_id=g.user.id, home_id=home.id, role='member')
    db.session.add(new_link)
    g.user.home_id = home.id # Automatically switch to new home
    db.session.commit()
    
    return jsonify({'success': True, 'home_id': home.id})
    
@auth_bp.route('/create_home', methods=['POST'])
def create_home():
    if not hasattr(g, 'user'):
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    home_name = data.get('home_name')
    if not home_name:
        return jsonify({'error': 'Home name required'}), 400
        
    home = Home(
        name=home_name,
        join_code=generate_join_code()
    )
    db.session.add(home)
    db.session.flush()
    
    new_link = UserHome(user_id=g.user.id, home_id=home.id, role='owner')
    db.session.add(new_link)
    g.user.home_id = home.id
    db.session.commit()
    
    return jsonify({'success': True, 'home_id': home.id, 'join_code': home.join_code, 'home_name': home.name})

@auth_bp.route('/invite/<code>', methods=['GET'])
def get_invite_preview(code):
    home = Home.query.filter_by(join_code=code).first()
    if not home:
        return jsonify({'error': 'Invalid or expired invite link'}), 404
        
    # Get members to show in preview
    member_links = UserHome.query.filter_by(home_id=home.id).limit(5).all()
    members = []
    for link in member_links:
        user = db.session.get(User, link.user_id)
        if user:
            members.append({
                'display_name': user.display_name,
                'avatar': user.avatar
            })
            
    total_members = UserHome.query.filter_by(home_id=home.id).count()
    
    return jsonify({
        'name': home.name,
        'members': members,
        'total_members': total_members
    })

@auth_bp.route('/google/login')
def google_login():
    # Build OAuth Flow
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri='http://localhost:3004/api/auth/google/callback' if request.host.startswith('localhost') else 'https://donespace.ir/api/auth/google/callback'
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    return jsonify({'url': authorization_url})

@auth_bp.route('/google/callback')
def google_callback():
    state = request.args.get('state')
    
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        state=state,
        redirect_uri='http://localhost:3004/api/auth/google/callback' if request.host.startswith('localhost') else 'https://donespace.ir/api/auth/google/callback'
    )
    
    # Use the authorization server response to fetch the OAuth 2.0 tokens.
    authorization_response = request.url
    # For local dev without HTTPS
    if "http://" in authorization_response:
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
        
    flow.fetch_token(authorization_response=authorization_response)
    credentials = flow.credentials
    
    # Get user info from id_token
    try:
        user_info = id_token.verify_oauth2_token(credentials.id_token, google_requests.Request(), flow.client_config['client_id'])
    except ValueError:
        return jsonify({'error': 'Invalid token'}), 400
        
    google_id = user_info['sub']
    email = user_info['email']
    name = user_info.get('name', '')
    picture = user_info.get('picture', '')
    
    # Find existing user or create new
    user = User.query.filter_by(email=email).first()
    
    if not user:
        # Generate a unique username
        base_username = email.split('@')[0]
        username = base_username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1
            
        user = User(
            username=username,
            display_name=name,
            email=email,
            avatar=picture,
            password_hash=generate_password_hash(secrets.token_urlsafe(16)), # Dummy password
            token=secrets.token_hex(32),
            google_id=google_id
        )
        db.session.add(user)
        db.session.flush()
    else:
        # Update google_id if not present
        if not user.google_id:
            user.google_id = google_id
        # Update avatar if they didn't have one
        if not user.avatar and picture:
            user.avatar = picture
            
        user.token = secrets.token_hex(32)
        
    # Store credentials for Calendar API
    user.google_access_token = credentials.token
    user.google_refresh_token = credentials.refresh_token if credentials.refresh_token else user.google_refresh_token
    user.google_token_expiry = credentials.expiry
    
    db.session.commit()
    
    # Redirect back to frontend
    from flask import redirect
    frontend_url = "http://localhost:3004/app" if request.host.startswith('localhost') else "https://donespace.ir/app"
    return redirect(f"{frontend_url}?token={user.token}")
