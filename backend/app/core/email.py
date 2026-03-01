import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_invitation_email(email_to: str, token: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print(f"Mock Email to {email_to}: Invite token is {token}")
        return

    msg = EmailMessage()
    msg['Subject'] = 'You are invited to Chalkboard!'
    msg['From'] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    msg['To'] = email_to
    
    invite_link = f"{settings.FRONTEND_URL}/register?token={token}"
    content = f"You have been invited to join Chalkboard!\n\nPlease register using the following link:\n{invite_link}"
    msg.set_content(content)

    print(f"Sending invite to {email_to} via SMTP2Go at {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"Error sending email: {e}")
