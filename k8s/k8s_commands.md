# docker common commands
docker build -t sundarigari/node  -f dockerfile .
docker push sundarigari/node # pushes to docker.io
docker pull sundarigari/node # pulls from docker.io
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


# Kubernites/minikube/common cmds
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
    kubectl create secret generic dbpass --from-literal=password=SfApps123
    kubectl get pod -l app=mysql  # get the pod name (to shell using cmd: kubectl exec -it podname sh)

# postgres 
    kubectl delete deployment postgres  
    kubectl delete service postgres  
## create secret
    kubectl create secret generic postgres-db-pass --from-literal=password=SfApps123
## create persistent volume claim
    kubectl apply -f C:\Users\Raja\Dropbox\Business\Chalaki\Clients\SoftForce\workspace\NodeApps2\NodeApps\k8s\pvc_pg.yaml    

## using manifest yml files: (The range of valid ports is 30000-32767)
    kubectl apply -f depoy_postgres.yml   
    kubectl apply -f service_postgres.yml   
## run psql and load data. Note: 30432 was the nodePort in the service_postgres.yml which is external port
    psql -h $(minikube ip) -p 30432 -d postgres -U postgres -f C:\users\Raja\limesurvey29.backup  
    gcloud config set project lambserver
    psql -h 35.226.40.14 -p 30432 -d postgres -U postgres -f C:\users\Raja\limesurvey29.1.backup  # gcloud
    pg_dump -h  35.226.40.14 -p 30432 -d postgres -U postgres   > C:\users\Raja\limesurvey29.1.backup  # gcloud

# redis 
kubectl delete deployment redis  
kubectl delete service redis  
## using cmdline arguments
### create secret
    kubectl create secret generic redis-password --from-literal=password=SfApps123
### create pvc
    kubectl apply -f C:\Users\Raja\Dropbox\Business\Chalaki\Clients\SoftForce\workspace\NodeApps2\NodeApps\k8s\pvc_redis.yaml
### direct cmd args    
    kubectl create deployment redis --image=redis  
    kubectl expose deployment redis --type=LoadBalancer --port=6379  
### using manifest yml files: (The range of valid ports is 30000-32767)
    kubectl apply -f depoy_redis.yml   
    kubectl apply -f service_redis.yml   

# LambServer install
## optional
## docker build -t sundarigari/lambserver:v6 -f .\k8s\DockerfileLambdaServerBase.txt .
kubectl delete deployment lambserver
docker rmi sundarigari/lambserver:v6
docker build -t sundarigari/lambserver:v6 -f .\k8s\DockerfileLambdaServer.txt .
docker push sundarigari/lambserver:v6
### assign role to lambserver to be cluster admin before deployment
kubectl apply -f ./k8s/create_serviceaccount.yml
kubectl apply -f ./k8s/create_servicerole_binding.yml

kubectl apply -f ./k8s/deploy_lambserver.yml   
kubectl apply -f ./k8s/service_lambserver.yml  


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
    /home/Dropbox/Business/Chalaki/Clients/SoftForce/workspace/NodeApps2/NodeApps  
### re-run lambda server from jenkins container manually:  
    node /home/Dropbox/Business/Chalaki/Clients/SoftForce/workspace/NodeApps2/NodeApps/lambda_server.js  

## VS Code launch for local dev with docker env
Start-Process  -NoNewWindow   "C:\Users\Raja\AppData\Local\Programs\Microsoft VS Code\Code.exe"