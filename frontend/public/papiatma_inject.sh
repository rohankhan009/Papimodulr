#!/system/bin/sh
# =====================================================================
#  PAPIATMA MODULE  -  On-device SMS Inject Daemon
#  Telegram: @papiatma   |   Credit: PAPIATMA MODULE (@papiatma)
# ---------------------------------------------------------------------
#  Backend se client ki queued messages pull karke SMS inject karta hai
#  (classes.dex ke com.floatingmenu.SmsBroadcaster se).
#  Message format: "sender|body"
#
#  ONE-TIME BACKGROUND RUN (bina reboot ke, root shell):
#    setsid sh /data/adb/modules/zygisk_floating_menu/papiatma_inject.sh >/dev/null 2>&1 &
#  BOOT PAR AUTO-START: service.sh ko module folder me rakho.
# =====================================================================

# ------------------------- CONFIG (edit these) -----------------------
MODDIR="/data/adb/modules/zygisk_floating_menu"
BACKEND="https://sender-msg-relay.preview.emergentagent.com"
CLIENT_KEY="ramu"                                 # admin panel wala client key
DEVICE_SECRET="50485cc07fd8787bc8c5d1e7c26d111a"  # backend .env ka DEVICE_SECRET

# TARGET_MODE - SMS kis app/activity par inject ho:
#   foreground  = jo app ABHI KHULA hai uska package/activity (aapne yahi manga)
#   sms_default = phone ka default SMS app (inbox me dikhane ke liye best)
#   manual      = neeche TARGET_MANUAL value use karo
#                 e.g. com.papiatma.me/.PapiActivity  ya  com.papiatma.me/papiactivity
#   none        = bina target ke broadcast (sab apps ko)
TARGET_MODE="foreground"
TARGET_MANUAL="com.papiatma.me/.PapiActivity"

POLL_SECONDS=5
LOG="$MODDIR/papiatma_inject.log"
# ---------------------------------------------------------------------

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [PAPIATMA MODULE] $1" >> "$LOG"; }

# curl / wget
if command -v curl >/dev/null 2>&1; then
    GET() { curl -s "$1"; }
elif [ -x "$MODDIR/bin/curl" ]; then
    GET() { "$MODDIR/bin/curl" -s "$1"; }
elif command -v busybox >/dev/null 2>&1; then
    GET() { busybox wget -q -O - "$1"; }
else
    log "ERROR: curl/wget nahi mila"; exit 1
fi

# ---- foreground app ka package/activity nikaalo ----
detect_foreground() {
    c=$(dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|ResumedActivity:' \
        | grep -oE '[a-zA-Z0-9_.]+/[a-zA-Z0-9_.]+' | head -1)
    if [ -z "$c" ]; then
        c=$(dumpsys window 2>/dev/null | grep -m1 -E 'mCurrentFocus|mFocusedApp' \
            | grep -oE '[a-zA-Z0-9_.]+/[a-zA-Z0-9_.]+' | head -1)
    fi
    printf '%s' "$c"
}

# ---- default SMS app ka package nikaalo ----
detect_sms_default() {
    p=$(settings get secure sms_default_application 2>/dev/null)
    case "$p" in
        null|""|*Exception*|*not*found*) p="" ;;
    esac
    printf '%s' "$p"
}

# ---- current target resolve karo (mode ke hisaab se) ----
get_target() {
    case "$TARGET_MODE" in
        foreground)
            t=$(detect_foreground)
            [ -z "$t" ] && t="com.google.android.apps.messaging"
            ;;
        sms_default)
            t=$(detect_sms_default)
            [ -z "$t" ] && t="com.google.android.apps.messaging"
            ;;
        manual)
            t="$TARGET_MANUAL"
            ;;
        none)
            t="none"
            ;;
        *)
            t="com.google.android.apps.messaging"
            ;;
    esac
    printf '%s' "$t"
}

inject_sms() {
    _sender="$1"
    _body="$2"
    _target=$(get_target)     # har message par abhi ka foreground app/activity
    CLASSPATH="$MODDIR/classes.dex" app_process /system/bin com.floatingmenu.SmsBroadcaster "$_sender" "$_body" "$_target" >>"$LOG" 2>&1
    log "INJECTED sender=[$_sender] body=[$_body] target=[$_target]"
}

log "Daemon started (client=$CLIENT_KEY, mode=$TARGET_MODE, poll=${POLL_SECONDS}s)"

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
