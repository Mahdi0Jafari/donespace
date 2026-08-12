def get_welcome_email_html(username):
    # Colors matching the landing page:
    # Purple: #8c52ff, Yellow: #fde047, Text: #1a1025, Background: #fdfcff
    
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to DoneSpace</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #fdfcff; font-family: 'Outfit', Arial, sans-serif; color: #1a1025; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fdfcff; padding: 40px 0;">
            <tr>
                <td align="center">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(140, 82, 255, 0.15); box-shadow: 0 10px 40px rgba(140, 82, 255, 0.08); overflow: hidden; margin: 0 20px;">
                        
                        <!-- Header -->
                        <tr>
                            <td align="center" style="background-color: #f4effa; padding: 40px 20px; border-bottom: 1px solid rgba(140, 82, 255, 0.1);">
                                <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 32px; color: #8c52ff; font-weight: 600; letter-spacing: -0.5px;">
                                    DoneSpace
                                </h1>
                            </td>
                        </tr>
                        
                        <!-- Body -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px;">
                                <h2 style="margin: 0 0 16px 0; font-family: 'Outfit', Arial, sans-serif; font-size: 24px; color: #1a1025;">
                                    Welcome, {username}! 👋
                                </h2>
                                <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #6b5e7a;">
                                    We are thrilled to have you join DoneSpace. You've just taken the first step towards a stress-free household, fair chore splitting, and shared meal planning.
                                </p>
                                
                                <div style="background-color: #fff9e6; border-left: 4px solid #fde047; padding: 16px; margin-bottom: 32px; border-radius: 4px;">
                                    <p style="margin: 0; font-size: 15px; color: #1a1025;">
                                        <strong>Pro Tip:</strong> Start by inviting your roommates or family members to your home dashboard. The more, the merrier!
                                    </p>
                                </div>
                                
                                <table border="0" cellspacing="0" cellpadding="0" width="100%">
                                    <tr>
                                        <td align="center">
                                            <a href="https://donespace.ir/app" style="display: inline-block; background-color: #8c52ff; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 100px; box-shadow: 0 4px 12px rgba(140, 82, 255, 0.3);">
                                                Go to Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td align="center" style="padding: 32px 40px; border-top: 1px solid #f0f0f0;">
                                <p style="margin: 0; font-size: 14px; color: #a097ad;">
                                    If you have any questions, simply reply to this email. We're always here to help.
                                </p>
                                <p style="margin: 16px 0 0 0; font-size: 12px; color: #c4bdcc;">
                                    © 2026 DoneSpace Inc. All rights reserved.<br>
                                    You are receiving this because you registered on donespace.ir.
                                </p>
                            </td>
                        </tr>
                        
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
