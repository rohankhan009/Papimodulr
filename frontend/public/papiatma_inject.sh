#!/system/bin/sh
# =====================================================================
#  PAPIATMA MODULE  -  On-device SMS Inject Daemon
#  Telegram: @papiatma
#  Credit: PAPIATMA MODULE (@papiatma)
# ---------------------------------------------------------------------
#  Ye script phone (rooted) par chalti hai. PAPIATMA MODULE backend se
#  apne client ki queued messages pull karti hai aur unhe SMS ke roop me
#  inject kar deti hai (classes.dex ke com.floatingmenu.SmsBroadcaster se).
#
#  Har message "sender|body" format me aata hai.
#
#  INSTALL / RUN:
#    1. Is file ko phone par copy karo, e.g.
#         /data/adb/modules/zygisk_floating_menu/papiatma_inject.sh
#    2. Executable banao:  chmod +x papiatma_inject.sh
#    3. Neeche CONFIG set karo (CLIENT_KEY + SMS_APP_PACKAGE).
#    4. Root shell me background me chalao:
#         nohup sh /data/adb/modules/zygisk_floating_menu/papiatma_inject.sh >/dev/null 2>&1 &
#       Ya module ke service.sh me ye line daal do (boot par auto-start).
# =====================================================================

# ------------------------- CONFIG (edit these) -----------------------
MODDIR="/data/adb/modules/zygisk_floating_menu"
BACKEND="https://sender-msg-relay.preview.emergentagent.com"
CLIENT_KEY="ramu"                                 # admin panel wala client key
DEVICE_SECRET="50485cc07fd8787bc8c5d1e7c26d111a"  # backend .env ka DEVICE_SECRET

# Aapke default SMS app ka package (jisme message dikhana hai):
#   Google Messages : com.google.android.apps.messaging
#   Samsung Messages : com.samsung.android.messaging
#   MIUI/Xiaomi      : com.android.mms
#   "none"           : bina package ke broadcast (sab apps ko)
SMS_APP_PACKAGE="com.google.android.apps.messaging"

POLL_SECONDS=5                                     # kitni der me dubara check kare
LOG="$MODDIR/papiatma_inject.log"
# ---------------------------------------------------------------------

# curl / wget dhoondo
if command -v curl >/dev/null 2>&1; then
    GET() { curl -s "$1"; }
elif [ -x "$MODDIR/bin/curl" ]; then
    GET() { "$MODDIR/bin/curl" -s "$1"; }
elif command -v busybox >/dev/null 2>&1; then
    GET() { busybox wget -q -O - "$1"; }
else
    echo "$(date) [PAPIATMA MODULE] ERROR: curl/wget nahi mila" >> "$LOG"
    exit 1
fi

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [PAPIATMA MODULE] $1" >> "$LOG"; }

inject_sms() {
    _sender="$1"
    _body="$2"
    CLASSPATH="$MODDIR/classes.dex" app_process /system/bin com.floatingmenu.SmsBroadcaster "$_sender" "$_body" "$SMS_APP_PACKAGE" >>"$LOG" 2>&1
    log "INJECTED sender=[$_sender] body=[$_body] pkg=[$SMS_APP_PACKAGE]"
}

log "PAPIATMA MODULE daemon started (client=$CLIENT_KEY, poll=${POLL_SECONDS}s, pkg=$SMS_APP_PACKAGE)"

while true; do
    URL="$BACKEND/api/device/pull?key=$CLIENT_KEY&secret=$DEVICE_SECRET&max=20"
    RESP=$(GET "$URL" 2>/dev/null)

    if [ -n "$RESP" ]; then
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
