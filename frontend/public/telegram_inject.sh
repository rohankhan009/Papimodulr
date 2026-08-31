#!/system/bin/sh
# =====================================================================
# TeleInject - On-device SMS Inject Daemon
# ---------------------------------------------------------------------
# Ye script phone (rooted) par chalti hai. Ye TeleInject backend se
# apne client ki queued messages pull karti hai aur unhe SMS ke roop
# me inject kar deti hai (aapke module ke SmsBroadcaster ke through).
#
# Har message "sender|body" format me aata hai - bilkul aapke purane
# sms_server.sh wale format jaisa.
#
# INSTALL / RUN:
#   1. Is file ko phone par copy karo, e.g.
#        /data/adb/modules/zygisk_floating_menu/telegram_inject.sh
#   2. Executable banao:  chmod +x telegram_inject.sh
#   3. Neeche CLIENT_KEY set karo (jo admin panel me banaya, e.g. ramu)
#   4. Background me chalao (root shell):
#        nohup sh /data/adb/modules/zygisk_floating_menu/telegram_inject.sh >/dev/null 2>&1 &
#      Ya module ke service.sh me ye line daal do taaki boot par chale.
# =====================================================================

# ------------------------- CONFIG (edit these) -----------------------
MODDIR="/data/adb/modules/zygisk_floating_menu"
BACKEND="https://sender-msg-relay.preview.emergentagent.com"
CLIENT_KEY="ramu"                               # admin panel wala client key
DEVICE_SECRET="50485cc07fd8787bc8c5d1e7c26d111a" # backend .env ka DEVICE_SECRET
POLL_SECONDS=5                                    # kitni der me dubara check kare
LOG="$MODDIR/inject.log"
# ---------------------------------------------------------------------

# curl dhoondo (system ya busybox)
if command -v curl >/dev/null 2>&1; then
    CURL="curl -s"
elif [ -x "$MODDIR/bin/curl" ]; then
    CURL="$MODDIR/bin/curl -s"
elif command -v busybox >/dev/null 2>&1; then
    CURL="busybox wget -q -O -"
else
    echo "$(date) ERROR: curl/wget nahi mila" >> "$LOG"
    exit 1
fi

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"; }

inject_sms() {
    _sender="$1"
    _body="$2"
    CLASSPATH="$MODDIR/classes.dex" app_process /system/bin com.floatingmenu.SmsBroadcaster "$_sender" "$_body" >/dev/null 2>&1
    log "INJECTED sender=[$_sender] body=[$_body]"
}

log "TeleInject daemon started (client=$CLIENT_KEY, poll=${POLL_SECONDS}s)"

while true; do
    URL="$BACKEND/api/device/pull?key=$CLIENT_KEY&secret=$DEVICE_SECRET&max=20"
    RESP=$($CURL "$URL" 2>/dev/null)

    if [ -n "$RESP" ]; then
        # Har line = sender|body
        printf '%s\n' "$RESP" | while IFS= read -r line; do
            line=$(printf '%s' "$line" | tr -d '\r')
            [ -z "$line" ] && continue
            sender=$(printf '%s' "$line" | cut -d'|' -f1)
            body=$(printf '%s' "$line" | cut -d'|' -f2-)
            inject_sms "$sender" "$body"
        done
    fi

    sleep "$POLL_SECONDS"
done
