REM node install
REM docker client point to minikube docker host
REM export PATH=$PATH:'/mnt/c/Program Files (x86)/Kubernetes/Minikube/:/mnt/c/Program Files (x86)/Kubernetes/'
REM minikube.exe docker-env | Invoke-Expression
REM create deployment node from nodedeploy.yaml
kubectl delete deployment node
kubectl create -f .\NodeApps\k8s\nodedeploy.yaml

REM create services
REM kubectl expose deployment postgres --type=LoadBalancer --port=5432 # do it once
kubectl delete service node
kubectl expose deployment node --type=LoadBalancer --port=8081

REM dynamic port accessing
REM kubectl describe deployment/node # will show that label is app=node
REM kubectl describe deployment/postgres  # will show that label is app=postgres

SET $PG_PODNAME=$(kubectl get pods -l app=postgres -o go-template --template "{{range .items}}{{.metadata.name}}{{end}}")
SET $PG_PORT=$(kubectl get services/postgres -o go-template='{{(index .spec.ports 0).nodePort}}')

SET $NODE_PODNAME=$(kubectl get pods -l app=node -o go-template --template "{{range .items}}{{.metadata.name}}{{end}}")
SET $NODE_PORT=$(kubectl get services/node -o go-template='{{(index .spec.ports 0).nodePort}}')

REM copy files
kubectl cp  data\server.js ${NODE_PODNAME}:/server.js
kubectl cp  data\server.sh ${NODE_PODNAME}:/server.sh
kubectl cp  index.js ${NODE_PODNAME}:/index.js
REM kubectl exec -it ${NODE_PODNAME} rm *.js
kubectl exec -it ${NODE_PODNAME} chmod 777 server.sh
kubectl exec -it ${NODE_PODNAME} /bin/bash ./server.sh
