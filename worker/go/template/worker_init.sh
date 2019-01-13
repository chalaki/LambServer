set -x
file=".pidfile"
if [ -f "$file" ]
then
        
        echo "$file  found. pid is: "
        echo $(cat .pidfile)
        echo "worker was already running. bye"
else
        echo "$file not found."
        echo "starting node worker.js > worker.log &"
        (node ./worker.js > worker.log 2> worker.log) &
        sleep  1
        echo $! > "$file"
fi