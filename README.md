# LambServer - provides AWS Lambda like FaaS functionality for javascript and GO on kubernetes

## create redis deployment
kubectl apply -f redis-secrets.yaml  
kubectl apply -f pv_redis.yaml #pv and pvc  
kubectl apply deploy_redis.yaml  
kubectl apply service_redis.yaml  

## node.js
### web interface (node express)

|main code          |ejs views          |
|-------------------|-------------------|
|/lambda_server.js  |/views/index.ejs   |

### lambda example function in javascript 
/index.js  
all lambda must have one and only one exports.handler = async (event) => {  // function body }
### template files
/worker/node/template  
### generated code
/worker/node/userid/function-name  
    deploy_worker2.yml  
    service_worker2.yml  
    worker.js   
### testing the lambda function written in node.js
/AjaxText


## golang
### Go program 
/src/lambserver/main.go
### template files:  
/worker/go/template  
### generated code
/worker/go/userid/function-name  
   deploy_worker2.yml  
   service_worker2.yml  
   worker.sh  
### web interface
chi 
routes.json
