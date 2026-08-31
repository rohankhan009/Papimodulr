#!/system/bin/sh
# =====================================================================
#  PAPIATMA MODULE  -  service.sh  (Magisk / KernelSU late_start service)
#  Telegram: @papiatma
# ---------------------------------------------------------------------
#  Ye file module folder me rakho:
#    /data/adb/modules/papiatma_module/service.sh
#  Magisk/KernelSU ise boot ke baad AUTOMATICALLY root me chalate hain.
#  Ye SMS inject daemon ko background me start karta hai aur agar wo
#  band ho jaye to dubara start kar deta hai (keep-alive / watchdog).
# =====================================================================

MODDIR=${0%/*}
LOG="$MODDIR/papiatma_service.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') [PAPIATMA MODULE] service.sh loaded" >> "$LOG"

# 1) Boot complete hone ka wait
while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 3
done

# 2) System settle + network aane ka thoda wait
sleep 25

echo "$(date '+%Y-%m-%d %H:%M:%S') [PAPIATMA MODULE] boot done, starting daemon watchdog" >> "$LOG"

# 3) Keep-alive watchdog: daemon band ho to dubara chalu
(
    while true; do
        sh "$MODDIR/papiatma_inject.sh"
        echo "$(date '+%Y-%m-%d %H:%M:%S') [PAPIATMA MODULE] daemon exit hua, 5s me restart" >> "$LOG"
        sleep 5
    done
) &
