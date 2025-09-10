#!/bin/bash
# ====================================================================================================
# TEST: Email History Sync Function
# ====================================================================================================
# Script pour tester la fonction de synchronisation des emails des 7 derniers jours
# ====================================================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Email History Sync Test ===${NC}"
echo "Testing the email-history-sync Edge Function..."
echo

# Load environment variables
if [ -f .env.local ]; then
    echo -e "${YELLOW}Loading environment variables...${NC}"
    source .env.local
else
    echo -e "${RED}Error: .env.local file not found${NC}"
    exit 1
fi

# Check required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: Missing required environment variables${NC}"
    echo "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo -e "${YELLOW}Supabase URL:${NC} $SUPABASE_URL"
echo

# ====================================================================================================
# 1. Check current statistics before sync
# ====================================================================================================
echo -e "${BLUE}1. Current email statistics:${NC}"

STATS_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/get_email_stats" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Current stats retrieved${NC}"
    echo "$STATS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATS_RESPONSE"
else
    echo -e "${YELLOW}⚠ Could not retrieve current stats${NC}"
fi

echo

# ====================================================================================================
# 2. Test the email-history-sync function
# ====================================================================================================
echo -e "${BLUE}2. Calling email-history-sync function:${NC}"

FUNCTION_URL="$SUPABASE_URL/functions/v1/email-history-sync"

echo -e "${YELLOW}Function URL:${NC} $FUNCTION_URL"
echo

# Call the function
SYNC_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  --max-time 120)

# Extract response body and status code
HTTP_BODY=$(echo "$SYNC_RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$SYNC_RESPONSE" | tail -n 1)

echo -e "${YELLOW}HTTP Status:${NC} $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Function executed successfully${NC}"
    echo -e "${YELLOW}Response:${NC}"
    echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
    
    # Parse the result
    SUCCESS=$(echo "$HTTP_BODY" | jq -r '.success // false' 2>/dev/null || echo "false")
    SENT_EMAILS=$(echo "$HTTP_BODY" | jq -r '.result.sentEmails // 0' 2>/dev/null || echo "0")
    RECEIVED_EMAILS=$(echo "$HTTP_BODY" | jq -r '.result.receivedEmails // 0' 2>/dev/null || echo "0")
    TRACKED_EMAILS=$(echo "$HTTP_BODY" | jq -r '.result.trackedEmails // 0' 2>/dev/null || echo "0")
    REPLIES_DETECTED=$(echo "$HTTP_BODY" | jq -r '.result.repliesDetected // 0' 2>/dev/null || echo "0")
    
    echo
    echo -e "${BLUE}Sync Results:${NC}"
    echo -e "  ${GREEN}Sent emails processed:${NC} $SENT_EMAILS"
    echo -e "  ${GREEN}Received emails processed:${NC} $RECEIVED_EMAILS"
    echo -e "  ${GREEN}Tracked emails created:${NC} $TRACKED_EMAILS"
    echo -e "  ${GREEN}Replies detected:${NC} $REPLIES_DETECTED"
    
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ Email history sync completed successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Function returned success=false${NC}"
    fi
    
else
    echo -e "${RED}✗ Function failed with HTTP $HTTP_CODE${NC}"
    echo -e "${YELLOW}Response:${NC}"
    echo "$HTTP_BODY"
fi

echo

# ====================================================================================================
# 3. Check updated statistics after sync
# ====================================================================================================
echo -e "${BLUE}3. Updated email statistics:${NC}"

# Wait a moment for database updates
sleep 2

UPDATED_STATS=$(curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/get_email_stats" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Updated stats retrieved${NC}"
    echo "$UPDATED_STATS" | jq '.' 2>/dev/null || echo "$UPDATED_STATS"
else
    echo -e "${YELLOW}⚠ Could not retrieve updated stats${NC}"
fi

echo

# ====================================================================================================
# 4. Check recent activity
# ====================================================================================================
echo -e "${BLUE}4. Recent email activity:${NC}"

ACTIVITY_RESPONSE=$(curl -s -X GET \
  "$SUPABASE_URL/rest/v1/recent_email_activity?limit=10" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Recent activity retrieved${NC}"
    echo "$ACTIVITY_RESPONSE" | jq '.' 2>/dev/null || echo "$ACTIVITY_RESPONSE"
else
    echo -e "${YELLOW}⚠ Could not retrieve recent activity${NC}"
fi

echo

# ====================================================================================================
# 5. Summary and recommendations
# ====================================================================================================
echo -e "${BLUE}=== Test Summary ===${NC}"

if [ "$HTTP_CODE" = "200" ] && [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Email history sync function is working correctly${NC}"
    echo
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Set up a scheduled cron job to run this function daily"
    echo "2. Monitor the function logs for any errors"
    echo "3. Verify that reply detection is working as expected"
    echo
    echo -e "${YELLOW}To schedule daily sync, you can:${NC}"
    echo "- Use GitHub Actions with a daily cron job"
    echo "- Set up a server-side cron job to call the function"
    echo "- Use Supabase Database Webhooks on a schedule"
else
    echo -e "${RED}✗ Email history sync function has issues${NC}"
    echo
    echo -e "${BLUE}Troubleshooting steps:${NC}"
    echo "1. Check Microsoft Graph access token in Supabase Vault"
    echo "2. Verify Microsoft Graph API permissions"
    echo "3. Check Supabase Edge Function logs"
    echo "4. Ensure database functions are properly deployed"
fi

echo
echo -e "${BLUE}=== Test Complete ===${NC}"