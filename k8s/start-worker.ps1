# node install
# docker client point to minikube docker host
# minikube.exe docker-env | Invoke-Expression
# create deployment node from nodedeploy.yaml
kubectl delete deployment node

kubectl create -f .\workspace\NodeApps2\NodeApps\k8s\nodedeploy.yaml

#create services
#kubectl expose deployment postgres --type=LoadBalancer --port=5432 # do it once
kubectl delete service node
kubectl expose deployment node1212 --type=LoadBalancer --port=8081

# dynamic port accessing
# kubectl describe deployment/node # will show that label is app=node
# kubectl describe deployment/postgres  # will show that label is app=postgres  

# $PG_PODNAME = $(kubectl get pods -l app=postgres -o go-template --template "{{range .items}}{{.metadata.name}}{{end}}")
# $PG_PORT = $(kubectl get services/postgres -o go-template='{{(index .spec.ports 0).nodePort}}')

$NODE_PODNAME = $(kubectl get pods -l app=node1212 -o go-template --template "{{range .items}}{{.metadata.name}}{{end}}")
# $NODE_PORT = $(kubectl get services/node -o go-template='{{(index .spec.ports 0).nodePort}}')

# copy files
kubectl cp  data\server.js ${NODE_PODNAME}:/server.js
kubectl cp  data\server.sh ${NODE_PODNAME}:/server.sh
kubectl cp  index.js ${NODE_PODNAME}:/index.js
# kubectl exec -it ${NODE_PODNAME} rm *.js
kubectl exec -it ${NODE_PODNAME} chmod 777 server.sh
kubectl exec -it ${NODE_PODNAME} /bin/bash ./server.sh
