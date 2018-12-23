# set -x
# file=".pidfile"
# if [ -f "$file" ]
# then
# 	kill $(cat .pidfile)
# else
# 	echo "$file not found."
# fi
echo "starting node worker.js > worker.log"
node worker.js > worker.log 
# sleep 1
# echo $! > .pidfile
# set +x