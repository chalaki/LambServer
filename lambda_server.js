"use strict";
const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const { execSync } = require('child_process');

const fs = require('fs');

const request = require('request');

const redis = require('redis');
var redis_port = 30379;
var redis_dns = '104.154.169.162'; //'192.168.99.100';
var redis_key;

var worker_dns = redis_dns;
var worker_platform = 'node';
var userid = 'sund';
var function_name = 'myfunc';

var uenv;
const { format, createLogger, transports } = require('winston');
const logger = createLogger({
    format: format.combine(
        format.label({ label: 'lambserver' }),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        //
        // The simple format outputs
        // `${level}: ${message} ${[Object with everything else]}`
        //
        format.simple()
        //
        // Alternatively you could use this custom printf format if you
        // want to control where the timestamp comes in your final message.
        // Try replacing `format.simple()` above with this:
        //
        //format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new transports.Console()
    ]
});
logger.info('winston logger is working');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs')
var startTime = new Date().getTime();

app.get('/', function (req, res) {
    var worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
    var indexfile = worker_folder + 'index.js';
    var origindexfilecont = fs.existsSync(indexfile) ? fs.readFileSync(indexfile, 'utf8') : '';
    res.render('index', {
        userid: userid, worker_platform: worker_platform, function_name: function_name,
        worker_code: origindexfilecont, worker_log: null, worker_output: null, error: null,
        worker_event: null
    });
})
//todo  worker folder may not exist

var worker_svc_ext_port; var deployment_name; //var docker_image;

app.post('/', function (request, response) {

    var worker_folder = './worker/' + worker_platform + '/' + userid + '/' + function_name + '/';
    var indexfile = worker_folder + 'index.js';

    startTime = new Date().getTime();
    logger.info("########################################### app.post at: ", new Date().toString());
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
            deployment_name = userid + worker_platform + function_name;// + worker_svc_ext_port;
            redis_client.set(redis_key, JSON.stringify({ deployment_name: deployment_name, worker_svc_ext_port: worker_svc_ext_port }), redis.print);
        }
        else {
            uenv = JSON.parse(result);
            deployment_name = uenv.deployment_name;
            worker_svc_ext_port = uenv.worker_svc_ext_port;
            if (!worker_svc_ext_port) worker_svc_ext_port = (Math.floor(Math.random() * (2767)) + 30000).toString();
        }
        var func_changed = origindexfilecont.trim() != request.body.code.trim();
        var docker_running = false;
        // try {
        //     execSync("docker inspect -f '{{.State.Running}}' " + deployment_name);
        //     docker_running = true;
        // }
        // catch {
        //     console.info(deployment_name + " worker container not running");
        //     docker_running = false;
        // }
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
            var prev_deployment_name = deployment_name;
            //var prev_docker_image = prev_deployment_name + "_img";

            //worker_ext_port = (Math.floor(Math.random() * (10000)) + 30000).toString();
            deployment_name = userid + worker_platform + function_name;//+ worker_ext_port;
            //docker_image = 'sundarigari/' + deployment_name;

            //var docker_build_cmd = 'docker build -t ' + docker_image + ' ' + worker_folder;
            //var docker_push_cmd = 'docker push ' + docker_image;
            //var docker_run_cmd = 'docker run -d --name ' + docker_name + ' -t -p 0.0.0.0:' + worker_ext_port + ':' + worker_int_port.toString() + '/tcp  ' + docker_image;
            var data = fs.readFileSync(worker_folder + 'deploy_worker.yml', 'utf8');
            var result = data.replace(/nodeworker/g, deployment_name);
            fs.writeFileSync(worker_folder + 'deploy_worker2.yml', result, 'utf8');
            data = fs.readFileSync(worker_folder + 'service_worker.yml', 'utf8');
            result = data.replace(/nodeworker/g, deployment_name).replace(/30000/g, worker_svc_ext_port);
            fs.writeFileSync(worker_folder + 'service_worker2.yml', result, 'utf8');

            var deployment_create_cmd = 'kubectl apply -f  ' + worker_folder + 'deploy_worker2.yml';  // todo replace worker with docker_image
            var pod_getname = 'kubectl get pod -l app=' + deployment_name + ' -o jsonpath="{.items[0].metadata.name}" > ' + worker_folder + '.podfile';


            var service_create_cmd = 'kubectl apply -f ' + worker_folder + 'service_worker2.yml';
            redis_client.set(redis_key, JSON.stringify({ deployment_name: deployment_name, worker_svc_ext_port: worker_svc_ext_port }), redis.print);

            logger.info(deployment_create_cmd);
            exec(deployment_create_cmd, (err, stdout, stderr) => {

                if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);

                execSync(pod_getname);
                var podname = fs.readFileSync(worker_folder + '.podfile', 'utf8');
                var pod_copy_files = 'kubectl cp ' + indexfile + '  default/' + podname + ':/'
                var pod_start_worker_cmd = 'kubectl exec ' + podname + ' ash ./worker.sh';

                logger.info(pod_copy_files);
                exec(pod_copy_files, (err, stdout, stderr) => {

                    if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                    let url = 'http://' + worker_dns + ':' + worker_svc_ext_port + '/';

                    logger.info(service_create_cmd);
                    exec(service_create_cmd, (err, stdout, stderr) => {

                        // todo get port
                        if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                        logger.info(pod_start_worker_cmd);
                        exec(pod_start_worker_cmd, (err, stdout, stderr) => {
                            // todo create service and get port
                            if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                            setTimeout(() => { postAndRender(url, request, response, podname, prev_deployment_name, null) }, 1000);
                        });
                    });
                });
            });
        }
        else {
            let url = 'http://' + worker_dns + ':' + worker_svc_ext_port + '/';
            postAndRender(url, request, response, deployment_name, null, null);
        }
    })
});


function postAndRender(url, req, res, podname, prevdock, prevdocimage) {


    logger.info('##### postAndRender url:' + url);
    request.post({ url: url, body: req.body.event }, function (err, response2, body) {

        var local_worker_log_file = './workerlogs/' + podname + '.log';
        var docker_copy_logfile_cmd = 'kubectl cp ' + podname + ':/worker.log  ' + local_worker_log_file; // copies worker.log into folder named podname
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
                logger.info("Rendered at: ", new Date().toString() + ' elapsed: ' + (renderTime - startTime) / 1000.0);
                //if (prevdock) setTimeout(() => { dockerCleanup(prevdock, prevdocimage); }, 1000);
            });
        });
    });
}

function dockerCleanup(prevdocker, prevdocimage) {
    logger.info('##### dockerCleanup (' + prevdocker + ')');
    var cmd_stop_prev_container = 'docker stop ' + prevdocker;
    var cmd_rm_prev_container = 'docker rm -f ' + prevdocker;
    var cmd_rmi_prev_image = 'docker rmi ' + prevdocimage;
    logger.info('##### ' + cmd_stop_prev_container + '\n');
    exec(cmd_stop_prev_container, (err, stdout, stderr) => {
        if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
        logger.info('########## ' + cmd_rm_prev_container + '\n');
        setTimeout(() => {
            exec(cmd_rm_prev_container, (err, stdout, stderr) => {
                if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                logger.info('########## ' + cmd_rmi_prev_image + '\n');
                setTimeout(() => {
                    exec(cmd_rmi_prev_image, (err, stdout, stderr) => {
                        if (`${stdout}` != "") logger.info(`${stdout}`); if (`${stderr}` != "") logger.error(`${stderr}`);
                        var afterCleanupTime = new Date().getTime();
                        logger.info("############### Cleanup at: ", new Date().toString() + ' elapsed: ' + (afterCleanupTime - startTime) / 1000.0);
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
redis_client.auth('SfApps123');
redis_client.on('error', function (err) { logger.info('Something went wrong with redis ', err) });
//redis_client.set('mykey', JSON.stringify({ v: 'redis is', j: 'working' }));
redis_client.get('mykey', function (error, result) {
    if (error) throw error;
    logger.info('mykey', JSON.parse(result));
});
//app.listen(port, function () { logger.info('Chalaki serverless listening on port 80 go to http://localhost:' + port) });