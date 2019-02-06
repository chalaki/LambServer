set -x
file=".pidfile"
if [ -f "$file" ]
then
        kill $(cat .pidfile)
else
        echo "$file not found."
fi
echo "re-starting  worker.exe > worker.log &"
(./worker.exe > worker.log 2> worker.log) &
sleep  1
echo $! > "$file"