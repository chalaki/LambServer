# docker common commands
docker build -t sundarigari/node  -f dockerfile .
docker push sundarigari/node # pushes to docker.io
docker pull sundarigari/node # pulls from docker.io
docker run -d --name lambserver -t -p 0.0.0.0:80:80/tcp  -v /var/run/docker.sock:/var/run/docker.sock sundarigari/lambserver:v17
docker run -d --name worker -t -p 0.0.0.0:81:81/tcp  -v /var/run/docker.sock:/var/run/docker.sock sundarigari/nodeworker

docker cp  c:/temp/index.js runr:/
docker exec -d runr bash server.sh
docker stop runr
docker rm runr
docker-machine env
docker save -o nodeimage.tar sundarigari/nodeimage:version3
docker load -i nodeimage.tar
docker commit 

#gcloud
gcloud components install kubectl  
gcloud config set project [PROJECT_ID]  
gcloud config set compute/zone us-central1-b  
gcloud container clusters create persistent-disk-tutorial --num-nodes=3
gcloud container clusters get-credentials persistent-disk-tutorial
gcloud auth configure-docker


# Kubernites/minikube/common cmds
kubectl custer-info
kubectl get all # gets all k8 objects pods,deployments,rs,configmaps,services,jobs etc

kubectl get -o=name pvc,configmap,serviceaccount,secret,ingress,service,deployment,statefulset,hpa,job,cronjob,pod # returns all pods, deployments, secrets etc.
kubectl get -o=yaml --export pod/mc1 > mc1.yaml  # use pod/podname or deployment/dname etc.
kubectl describe pod # to see what image a pod is using
kubectl edit pod podname # gets and edits the yaml in vi. On save it wil be applied.


## kublectl can work with multiple clusters (minikube, gcloud, AWS etc).   
### work with gcloud
    gcloud container clusters get-credentials lambserver-cluster --zone us-central1-a --project lambserver #get gcloud cluster cotext to c:/users/user-name/.kube/config
    kubectl config get-contexts  
    kubectl config use-context contextName  # choose between gcloud/minikube/AWS context
    kubectl config get-clusters  
    gcloud compute firewall-rules create open-all-ports --allow tcp:30000-32767  # to open all ports
    kubectl get nodes --output=wide 
    # to get nodes and their external ips. Use node-externalip:nodePort where nodePort is the value of nodePort in service type=NodePort to access from internet
### work with minikube
    minikube start  
    minikube docker-env # follow instruction to run last line to have docker client point to minikube docker host  
    minikube dashboard  
    minikube service node  
### k8s common commands
    kubectl get pods  
    kubecl get services  
    kubectl create deployment postgres --image=postgres  # create deployment cmdline
    kubectl apply -f depoy_postgres.yml   # create deployment from manifest in yml
    kubectl expose deployment postgres --type=LoadBalancer --port=5432  # create service cmdline
    kubectl apply -f service_postgres.yml   # create service from manifest in yml
    kubectl get pvc  # get persistant volume claims
    kubectl create secret generic dbpass --from-literal=password=postgres123
    kubectl get pod -l app=mysql  # get the pod name (to shell using cmd: kubectl exec -it podname sh)
    kubectl delete StatefulSet --all
    
# postgres 
    kubectl delete deployment postgres  
    kubectl delete service postgres  
## create secret
    kubectl create secret generic postgres-db-pass --from-literal=password=postgres123
## create persistent volume claim
    kubectl apply -f pvc_pg.yaml    

- using manifest yml files: (The range of valid ports is 30000-32767)
+ kubectl apply -f deploy_postgres.yml   
- kubectl apply -f service_postgres.yml 
+ kubectl get -o jsonpath="{.spec.ports[0].nodePort}" services postgres # to see nodePort of postgres service  
## run psql and load data. Note: 30432 was the nodePort in the service_postgres.yml which is external port
    psql -h $(minikube ip) -p 30432 -d postgres -U postgres -f C:\users\Raja\limesurvey29.backup  
    psql -h 104.154.26.17 -p 5432 -d postgres -U postgres -f C:\users\Raja\limesurvey29.backup  # gcloud SQL
    pg_dump -h  35.226.248.125 -p 30432 -d postgres -U postgres   > C:\users\Raja\limesurvey29.1.backup  # gcloud

# redis 
kubectl delete deployment redis  
kubectl delete service redis  
### create secret
    kubectl create secret generic redis-password --from-literal=password=postgres123
### create pvc
    kubectl apply -f pvc_redis.yaml   
### create deployment and service using manifest yml files: (The range of valid ports is 30000-32767)   
    kubectl apply -f deploy_redis.yml   
    kubectl apply -f service_redis.yml   

# LambServer install
## optional worker image build and push
docker build -t sundarigari/lamb-worker-node:v17   .\worker\node\template\
docker push sundarigari/lamb-worker-node:v17

## docker images
    docker build -t sundarigari/node.11-alpine.exp.redis.kctl -f .\DockerfileLambdaServerBase.txt .\
    docker build -t sundarigari/lambserver:v17 .\
docker push sundarigari/lambserver:v17
### assign role to lambserver to be cluster admin before deployment
    kubectl apply -f create_serviceaccount.yml
    kubectl apply -f create_servicerole_binding.yml
### create pvc
    kubectl apply -f pvc_lambserver.yaml   
### create deployment and service
    kubectl delete deployment lambserver
    kubectl apply -f deploy_lambserver.yml   
    kubectl apply -f service_lambserver_lb.yml  
### open firewall for workers to be accessed at nodePort
gcloud compute firewall-rules create open-all-ports --allow tcp:30000-32767  

### access lamb server shell or watch logs
kubectl exec $(kubectl get pod -l app=lambserver -o jsonpath="{.items[0].metadata.name}") -it bash
kubectl exec -it  $(kubectl get pod -l app=lambserver -o jsonpath="{.items[0].metadata.name}") tail -- -f logs/lambserver-2019-MM-DD.log
kubectl port-forward --namespace default $(kubectl get pod -l app=lambserver -o jsonpath="{.items[0].metadata.name}") 80 ## to access at http://localhost

gcloud config set project lambserver
gcloud compute firewall-rules create lambserver-port --allow tcp:32080
### get node ip for any node
kubectl get nodes --output=wide
access lambserver at http://node-ip:32080

minikube service lambserver


## alternative commands
kubectl delete deployment lambserver  
kubectl create deployment lambserver --image=sundarigari/lambserver:v3  
kubectl delete service lambserver  
kubectl expose deployment lambserver --type=LoadBalancer --port=80  --nodePort:32020

curl $(minikube ip):$NODE_PORT  

# worker pod
## build and push docker image for worker
docker build -t sundarigari/lamb-worker-node ./worker/node/template
sundarigari/lamb-worker-node 
//kubectl create -f ./worker/node/template/createpod.yml 
kubectl create -f ./worker/node/sund/myfunc/deploy_worker2.yml
kubectl create -f ./worker/node/sund/myfunc/service_worker2.yml
$podname = $(kubectl get pod -l app=worker -o jsonpath="{.items[0].metadata.name}")
## copy index.js to pod then run
kubectl exec -ti $podname ash worker.sh


# Jenkins
docker run -d --name postgres -t -p 0.0.0.0:5432:5432/tcp  postgres  
docker run -d --name redis    -t -p 0.0.0.0:6379:6379/tcp  redis  
docker run --rm -d -u root --name jenkins -p 8080:8080 -v jenkins-data:/var/jenkins_home -v   //var/run/docker.sock:/var/run/docker.sock -v //c/Users/Raja/:/home jenkinsci/blueocean  
## jenkins create pipeline: 
choose script from SCM  
choose GIT  
### choose file path (or http path) pipeline:  
    ./workspace/NodeApps2/NodeApps  
### re-run lambda server from jenkins container manually:  
    node ./lambda_server.js  

## VS Code launch for local dev with docker env
Start-Process  -NoNewWindow   "C:\Users\Raja\AppData\Local\Programs\Microsoft VS Code\Code.exe"


# debug in k8
## run below command in the pod
node --inspect-brk=0.0.0.0 ./lambda_server.js 90
### run this in locally
kubectl port-forward lambserver-7b4857d87f-kmv4x 9229
### go to chrome://inspect/#devices in chrome browser to the the code and step thru it 

## go
go get k8s.io/client-go/...
