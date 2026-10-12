import os, json, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dealerdesk.settings')
django.setup()
from django.conf import settings
from groq import Groq
from core.assistant_views import TOOLS

client = Groq(api_key=settings.GROQ_API_KEY)

# Round 1
r1_messages = [{"role": "user", "content": "check stock for SKU FIL-1016"}]
resp1 = client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=r1_messages,
    tools=TOOLS
)
asst_msg = resp1.choices[0].message
print("Round 1 tool calls:", [(tc.id, tc.function.name) for tc in asst_msg.tool_calls])

# Prepare round 2
messages = list(r1_messages)
messages.append(asst_msg)
for tc in asst_msg.tool_calls:
    messages.append({
        "role": "tool",
        "tool_call_id": tc.id,
        "content": json.dumps({"results": [{"sku": "FIL-1016", "name": "Oil Filter", "stock": 45, "price": "180.00", "found": True}]})
    })

resp2 = client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=messages,
    tools=TOOLS
)
print("Round 2 reply:", resp2.choices[0].message.content.encode('ascii', errors='replace').decode())
