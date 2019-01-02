set -x
file=".pidfile"
if [ -f "$file" ]
then
        kill $(cat .pidfile)
else
        echo "$file not found."
fi
echo "re-starting node worker.js > worker.log &"
node ./worker.js > worker.log 2> worker.log &
sleep 1