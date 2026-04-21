"""
Webex Bot - Summary Command Handler

This is a lightweight bot that:
  1. Receives messages from Webex (via webhook)
  2. Parses the case number from the message
  3. Calls the ServiceNow Scripted REST API to get the summary
  4. Sends back a formatted Adaptive Card in Webex

Works for:
  - Path 2: Direct message to bot ("summary CS-12345")
  - Path 3: Bot added to Webex space ("@BotName summary CS-12345")

Setup:
  pip install webexteamssdk requests

Environment Variables:
  WEBEX_BOT_TOKEN        - Bot access token from developer.webex.com
  SERVICENOW_INSTANCE    - e.g. "your-company.service-now.com"
  SERVICENOW_USER        - ServiceNow user with REST API access
  SERVICENOW_PASSWORD    - Password for that user

Author: Jansi Gorle · CX · April 2026
"""

import os
import re
import requests
from webexteamssdk import WebexTeamsAPI

# --- Configuration ---
WEBEX_TOKEN = os.environ.get('WEBEX_BOT_TOKEN', '')
SN_INSTANCE = os.environ.get('SERVICENOW_INSTANCE', '')
SN_USER = os.environ.get('SERVICENOW_USER', '')
SN_PASS = os.environ.get('SERVICENOW_PASSWORD', '')

# Initialize Webex API client
api = WebexTeamsAPI(access_token=WEBEX_TOKEN)


def get_summary_from_servicenow(case_number):
    """
    Call the ServiceNow Scripted REST API to get AI summary.
    This hits the same _runPipeline logic that the button uses.
    """
    url = f"https://{SN_INSTANCE}/api/x_case_summary_api/summary/{case_number}"

    # Basic auth to ServiceNow REST API
    response = requests.get(
        url,
        auth=(SN_USER, SN_PASS),
        headers={'Accept': 'application/json'},
        timeout=90  # LLM call can take time
    )

    if response.status_code == 200:
        return response.json()
    elif response.status_code == 404:
        return {'success': False, 'error': f'Case {case_number} not found'}
    else:
        return {'success': False, 'error': f'ServiceNow returned HTTP {response.status_code}'}


def build_summary_card(case_number, data):
    """
    Build a Webex Adaptive Card with the summary sections.
    This is the card users see in Webex after requesting a summary.
    """
    sections = data.get('sections', {})
    timeline_count = data.get('timeline_count', 0)

    # Build card body with available sections
    card_body = [
        {
            "type": "TextBlock",
            "text": f"🤖 AI Summary — {case_number}",
            "weight": "Bolder",
            "size": "Medium"
        },
        {
            "type": "TextBlock",
            "text": f"{timeline_count} entries analyzed",
            "size": "Small",
            "color": "Accent",
            "spacing": "None"
        }
    ]

    # Add each section if present
    for header in ['Issue', 'Action Taken', 'Resolution']:
        if header in sections and sections[header]:
            card_body.append({
                "type": "TextBlock",
                "text": f"**{header}:**",
                "weight": "Bolder",
                "spacing": "Medium"
            })
            card_body.append({
                "type": "TextBlock",
                "text": sections[header],
                "wrap": True,
                "spacing": "Small"
            })

    # Footer
    card_body.append({
        "type": "TextBlock",
        "text": "Powered by CIRCUIT LLM",
        "size": "Small",
        "color": "Light",
        "spacing": "Large",
        "horizontalAlignment": "Right"
    })

    # Wrap in Adaptive Card structure
    card = {
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.3",
            "body": card_body
        }
    }

    return card


def handle_message(message_text, room_id):
    """
    Parse the user's message and respond with the summary.
    Supports formats:
      - "summary CS-12345"
      - "@BotName summary CS-12345"
      - "summarize CS-12345"
    """
    # Remove bot mention if present (for group spaces)
    clean_text = re.sub(r'<spark-mention.*?</spark-mention>', '', message_text).strip()

    # Extract case number using regex
    # Matches: CS-12345, INC0012345, cs-12345, etc.
    match = re.search(r'(CS-\d+|INC\d+)', clean_text, re.IGNORECASE)

    if not match:
        # No case number found — send help message
        api.messages.create(
            roomId=room_id,
            text="Please provide a case number. Example: summary CS-12345"
        )
        return

    case_number = match.group(1).upper()

    # Send "working on it" message
    api.messages.create(
        roomId=room_id,
        text=f"⏳ Generating AI summary for {case_number}..."
    )

    # Call ServiceNow
    result = get_summary_from_servicenow(case_number)

    if result.get('success'):
        # Build and send Adaptive Card
        card = build_summary_card(case_number, result)
        api.messages.create(
            roomId=room_id,
            text=f"AI Summary for {case_number}",  # Fallback text
            attachments=[card]
        )
    else:
        # Send error message
        error = result.get('error', 'Unknown error')
        api.messages.create(
            roomId=room_id,
            text=f"❌ Could not generate summary for {case_number}: {error}"
        )


# --- Webhook handler (Flask example) ---
# This is what Webex calls when someone messages the bot

def create_app():
    """
    Create a simple Flask app to receive Webex webhooks.
    Run with: python summary_command.py
    """
    from flask import Flask, request as flask_request
    app = Flask(__name__)

    @app.route('/webhook', methods=['POST'])
    def webhook():
        """Webex sends a POST here when someone messages the bot."""
        data = flask_request.json

        # Get the message details
        message_id = data.get('data', {}).get('id')
        if not message_id:
            return 'OK', 200

        # Fetch full message content (webhook only sends ID)
        message = api.messages.get(message_id)

        # Ignore messages from the bot itself
        if message.personEmail.endswith('@webex.bot'):
            return 'OK', 200

        # Handle the message
        handle_message(message.text, message.roomId)

        return 'OK', 200

    return app


if __name__ == '__main__':
    print("Starting Webex Bot for Case Summary...")
    print(f"ServiceNow instance: {SN_INSTANCE}")
    app = create_app()
    app.run(host='0.0.0.0', port=8080)
