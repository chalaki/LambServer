# node install
# docker client point to minikube docker host
# minikube.exe docker-env | Invoke-Expression
# create deployment node from nodedeploy.yaml
kubectl.exe delete deployment node
kubectl.exe create -f k8s/nodedeploy.yaml
#create services
#kubectl.exe expose deployment postgres --type=LoadBalancer --port=5432 # do it once
kubectl.exe delete service node
kubectl.exe expose deployment node1212 --type=LoadBalancer --port=8081
# dynamic port accessing
# kubectl.exe describe deployment/node # will show that label is app=node
# kubectl.exe describe deployment/postgres  # will show that label is app=postgres  
# $PG_PODNAME = $(kubectl.exe get pods -l app=postgres -o go-template --template "{{range .items}}{{.metadata.name}}{{end}}")
# $PG_PORT = $(kubectl.exe get services/postgres -o go-template='{{(index .spec.ports 0).nodePort}}')
$NODE_PODNAME = $(kubectl.exe get pods -l app=node1212 -o go-template --template "{{range .items}}{{.metadata.name}}{{end}}")
# $NODE_PORT = $(kubectl.exe get services/node -o go-template='{{(index .spec.ports 0).nodePort}}')
# copy files
kubectl.exe cp  data\server.js ${NODE_PODNAME}:/server.js
kubectl.exe cp  data\server.sh ${NODE_PODNAME}:/server.sh
kubectl.exe cp  index.js ${NODE_PODNAME}:/index.js
# kubectl.exe exec -it ${NODE_PODNAME} rm *.js 
kubectl.exe exec -it ${NODE_PODNAME} chmod 777 server.sh
kubectl.exe exec -it ${NODE_PODNAME} /bin/bash ./server.sh