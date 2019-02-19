"use strict";
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const { execSync } = require('child_process');

const k8_namespace = 'default';
const fs = require('fs');
const request = require('request');
const redis = require('redis');
var redis_port = 30379;  // 6379
var nodeip = '192.168.99.101';
//'10.0.2.15';//'35.226.248.125'; //;  // run minikube ip command to get ip of master
var redis_dns = nodeip;//'10.0.3.3';
var redis_key;
var worker_dns = nodeip;
var worker_platform = 'node';
var userid = 'sund';
var function_name = 'myfunc';
var uenv;
var winston = require('winston');

require('winston-daily-rotate-file');
var drf_transport = new (winston.transports.DailyRotateFile)({
    filename: 'logs/lambserver-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: '100m',
    maxFiles: '365d'
});

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.label({ label: 'lambserver' }),
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss' }),
        // The simple format outputs
        // `${level}: ${message} ${[Object with everything else]}`
        //format.simple()
        winston.format.printf(x => `${getIST(new Date(x.timestamp))} ls_${x.level}: ${x.message}`)
    ),
    transports: [new winston.transports.Console(), drf_transport]
});

const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')
var startTime = new Date().getTime();

app.get('/', function (req, res) {
    logger.info('lambserver GET\n...................................');
    var origindexfilecont;
    var worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
    var indexfile = worker_folder + 'index.js';
    if (!fs.existsSync(indexfile)) {
        worker_folder = './worker/' + worker_platform + '/template/';
        indexfile = worker_folder + 'index.js';
        origindexfilecont = fs.existsSync(indexfile) ? fs.readFileSync(indexfile, 'utf8') : '';
    }
    else origindexfilecont = fs.readFileSync(indexfile, 'utf8');

    res.render('index', {
        userid: userid, worker_platform: worker_platform, function_name: function_name,
        worker_code: origindexfilecont, worker_log: null, worker_output: null, error: null,
        worker_event: null
    });
})
//todo  worker folder may not exist

var worker_svc_ext_port; var worker_depl_name; //var docker_image;

app.post('/', function (request, response) {
    logger.info('...................................');
    logger.info('lambserver rcvd POST');
    var worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
    var indexfile = worker_folder + 'index.js';

    startTime = new Date().getTime();
    userid = request.body.userid;
    worker_platform = request.body.worker_platform;
    function_name = request.body.function_name;

    var origindexfilecont = fs.existsSync(indexfile) ? fs.readFileSync(indexfile, 'utf8') : '';

    worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
    var worker_template_folder = './worker/' + worker_platform + '/template/';
    indexfile = worker_folder + 'index.js';
    redis_key = userid + worker_platform + function_name + '_k8';

    redis_client.get(redis_key, function (error, result) {
        if (error || !result) {
            worker_svc_ext_port = (Math.floor(Math.random() * (2767)) + 30000).toString();
            worker_depl_name = userid + worker_platform + function_name;// + worker_svc_ext_port;
            redis_client.set(redis_key, JSON.stringify({ deployment_name: worker_depl_name, worker_svc_ext_port: worker_svc_ext_port }), redis.print);
        }
        else {
            uenv = JSON.parse(result);
            worker_depl_name = uenv.deployment_name;
            worker_svc_ext_port = uenv.worker_svc_ext_port;
            if (!worker_svc_ext_port) worker_svc_ext_port = (Math.floor(Math.random() * (2767)) + 30000).toString();
        }
        var func_changed = origindexfilecont.trim() != request.body.code.trim();
        logger.info("Did function change? " + func_changed);
        var docker_running = false;
        try {
            var kubectl_is_worker_running = 'kubectl get pod -l app=' + worker_depl_name + ' -o jsonpath="{.items[0].metadata.name}"';
            logger.info(kubectl_is_worker_running);
            execSync(kubectl_is_worker_running);
            docker_running = true;
            logger.info(worker_depl_name + " worker container already running");
        }
        catch {
            logger.info(worker_depl_name + " worker container not running");
            docker_running = false;
        }
        var pod_getname = '$(kubectl get pod -l app=' + worker_depl_name + ' -o jsonpath="{.items[0].metadata.name}")';

        if (func_changed || !docker_running) {
            var old_comspec = process.env.comspec;
            if (process.platform === 'win32') process.env.comspec = 'bash';
            // set config 
            var config = { userid: userid, worker_platform: worker_platform, function_name: function_name };
            execSync('echo \'' + JSON.stringify(config) + '\' > ' + worker_template_folder + 'worker.config');
            try {
                var worker_folder_parent = './worker/' + worker_platform + '/' + userid + '/';
                if (!fs.existsSync(worker_folder_parent)) execSync('mkdir ' + worker_folder_parent);
                if (!fs.existsSync(worker_folder)) execSync('mkdir ' + worker_folder);
            }
            catch  { }
            execSync('cp -r ' + worker_template_folder + '*  ' + worker_folder);
            process.env.comspec = old_comspec;

            fs.writeFileSync(indexfile, request.body.code);
            logger.info(indexfile + " saved.");

            // build run new image
            var prev_depl_name = worker_depl_name;
            //var prev_docker_image = prev_deployment_name + "_img";

            //worker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
            //worker_depl_name = userid + worker_platform + function_name;//+ worker_ext_port;
            //docker_image = 'sundarigari/' + deployment_name;

            //var docker_build_cmd = 'docker build -t ' + docker_image + ' ' + worker_folder;
            //var docker_push_cmd = 'docker push ' + docker_image;
            //var docker_run_cmd = 'docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + worker_ext_port + ':' + worker_int_port.toString() + '/tcp  ' + docker_image;
            var data = fs.readFileSync(worker_folder + 'deploy_worker.yml', 'utf8');
            var result = data.replace(/nodeworker/g, worker_depl_name);
            fs.writeFileSync(worker_folder + 'deploy_worker2.yml', result, 'utf8');
            data = fs.readFileSync(worker_folder + 'service_worker.yml', 'utf8');
            result = data.replace(/nodeworker/g, worker_depl_name).replace(/30000/g, worker_svc_ext_port);
            fs.writeFileSync(worker_folder + 'service_worker2.yml', result, 'utf8');

            var deployment_create_cmd = 'kubectl apply -f  ' + worker_folder + 'deploy_worker2.yml';  // todo replace worker with docker_image
            var service_create_cmd = 'kubectl apply -f ' + worker_folder + 'service_worker2.yml';
            redis_client.set(redis_key, JSON.stringify({ deployment_name: worker_depl_name, worker_svc_ext_port: worker_svc_ext_port }), redis.print);

            logger.info(deployment_create_cmd);
            exec(deployment_create_cmd, (err, stdout, stderr) => {

                if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);

                //execSync(pod_getname);
                //var podname = pod_getname;// fs.readFileSync(worker_folder + '.podfile', 'utf8');
                var pod_copy_files = 'kubectl cp ' + indexfile + '  ' + k8_namespace + '/' + pod_getname + ':/'
                var pod_restart_worker_cmd = 'kubectl exec ' + pod_getname + ' ash ./worker.sh'; // worker.sh always restarts node worker.js

                logger.info(pod_copy_files);
                exec(pod_copy_files, (err, stdout, stderr) => {

                    if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                    let url = 'http://' + worker_dns + ':' + worker_svc_ext_port + '/';

                    logger.info(service_create_cmd);
                    exec(service_create_cmd, (err, stdout, stderr) => {

                        // todo get port
                        if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                        logger.info(pod_restart_worker_cmd);
                        exec(pod_restart_worker_cmd, (err, stdout, stderr) => {
                            // todo create service and get port
                            if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                            setTimeout(() => { postAndRender(url, request, response, pod_getname, prev_depl_name, null) }, 1000);
                        });
                    });
                });
            });
        }
        else {
            logger.info("function did not change and container was already running. Just calling POST on worker...");

            var pod_init_worker_cmd = 'kubectl exec ' + pod_getname + ' ash ./worker_init.sh'; // worker_init.sh starts node worker.js only if its not started already
            logger.info(pod_init_worker_cmd);
            exec(pod_init_worker_cmd, (err, stdout, stderr) => {

                if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                let url = 'http://' + worker_dns + ':' + worker_svc_ext_port + '/';
                postAndRender(url, request, response, pod_getname, null, null);
            });
        }
    })
});

function postAndRender(url, req, res, get_podname, prevdock, prevdocimage) {

    logger.info('postAndRender url: ' + url);
    request.post({ url: url, body: req.body.event }, function (err, response2, body) {
        var logfilename = 'worker.log'; // todo  use unique file name per worker
        var local_worker_log_file = './workerlogs/' + logfilename;
        var docker_copy_logfile_cmd = 'kubectl cp ' + k8_namespace + '/' + get_podname + ':/worker.log  ' + local_worker_log_file;
        // copies worker.log into folder named podname
        if (err) {
            logger.error('error in POST to worker!!! may be worker did not start due to syntaxt error in handler');
            logger.error(err);
        }
        if (body) logger.info('postAndRender POST to worker successful! body: ' + body);
        else {
            body = '{}';
            logger.error('postAndRender POST to worker returned undefined body');
        }
        logger.info(docker_copy_logfile_cmd);
        exec(docker_copy_logfile_cmd, (err, stdout, stderr) => {

            if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
            const fs = require('fs');
            logger.info('Opening local log file for read: ' + local_worker_log_file);
            fs.readFile(local_worker_log_file, "utf8", function (err, data) {

                if (err) {
                    res.render('index', {
                        userid: userid, worker_event: JSON.stringify(JSON.parse(req.body.event), null, 2),
                        worker_platform: worker_platform, function_name: function_name, worker_code: req.body.code,
                        worker_output: url + err,
                        worker_log: url + err,
                        error: url + ' Error calling POST on worker'
                    });
                    logger.error(err);
                }
                else {
                    res.render('index', {
                        userid: userid, worker_event: JSON.stringify(JSON.parse(req.body.event), null, 2),
                        worker_platform: worker_platform, function_name: function_name, worker_code: req.body.code,
                        worker_output: JSON.stringify(JSON.parse(body), null, 2),
                        worker_log: data,
                        error: null
                    });
                    logger.info('Opened and read local log file');
                }
                var renderTime = new Date().getTime();
                logger.info('Rendered.  elapsed: ' + (renderTime - startTime) / 1000.0);
                //if (prevdock) setTimeout(() => { dockerCleanup(prevdock, prevdocimage); }, 1000);
            });
        });
    });
}

function getIST(d) {
    var offset = 5.5;
    // convert to msec subtract local time zone offset  get UTC time in msec
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    // create new Date object for different city using supplied offset
    var nd = new Date(utc + (3600000 * offset));
    return nd.toLocaleString();
}

function dockerCleanup(prevdocker, prevdocimage) {
    logger.info('---- dockerCleanup (' + prevdocker + ')');
    var cmd_stop_prev_container = 'docker stop ' + prevdocker;
    var cmd_rm_prev_container = 'docker rm -f ' + prevdocker;
    var cmd_rmi_prev_image = 'docker rmi ' + prevdocimage;
    logger.info('---- ' + cmd_stop_prev_container + '\n');
    exec(cmd_stop_prev_container, (err, stdout, stderr) => {
        if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
        logger.info('------ ' + cmd_rm_prev_container + '\n');
        setTimeout(() => {
            exec(cmd_rm_prev_container, (err, stdout, stderr) => {
                if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                logger.info('-------- ' + cmd_rmi_prev_image + '\n');
                setTimeout(() => {
                    exec(cmd_rmi_prev_image, (err, stdout, stderr) => {
                        if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                        var afterCleanupTime = new Date().getTime();
                        logger.info("---------- Cleanup at: ", new Date().toString() + ' elapsed: ' + (afterCleanupTime - startTime) / 1000.0);
                    });
                }, 5000);
            }, 5000);
        });
    });
}
var port = 80;
if (process.argv.length > 2) port = process.argv[2];
if (process.argv.length > 3) redis_dns = process.argv[3];
if (process.argv.length > 4) redis_port = process.argv[4];
if (process.argv.length > 5) worker_int_port = process.argv[5];
const redis_client = redis.createClient(redis_port, redis_dns);
redis_client.auth('redis123'); // password
redis_client.on('error', function (err) { logger.error('Something went wrong with redis '); logger.error(err); });
redis_client.set('mykey', JSON.stringify({ v: 'redis is', j: 'working' }));
redis_client.get('mykey', function (error, result) {
    if (error) throw error;
    logger.info('redis response: mykey:' + JSON.stringify(JSON.parse(result)));
});
app.listen(port, function () {
    logger.info('Chalaki serverless listening on port ' + port + ' go to http://load-balancer-ip:' + port);
    logger.info('--------------------------------------------------------------------------')
});